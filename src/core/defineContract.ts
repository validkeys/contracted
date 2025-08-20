import { z } from 'zod';
import { ErrorUnion, TaggedError } from './errors';
import {
  CurriedImplementation,
  ImplementationFunction,
  InferSchema
} from './types';

/**
 * Interface representing a fully implemented contract that can be executed.
 * 
 * An implemented contract contains all the metadata of a contract plus
 * the actual implementation function and convenience methods for execution.
 * 
 * @template TInput - The Zod schema type for input validation
 * @template TOutput - The Zod schema type for output validation
 * @template TDeps - The dependencies object type
 * @template TOptions - The options object type (defaults to empty record)
 * @template TErrors - Array of error constructor types that can be thrown
 * 
 * @example
 * ```typescript
 * const implementedContract: ImplementedContract<
 *   z.ZodObject<{ name: z.ZodString }>,
 *   z.ZodObject<{ id: z.ZodString, name: z.ZodString }>,
 *   { userRepo: UserRepository },
 *   { validateEmail?: boolean }
 * > = contract.implementation(async ({ input, deps, options }) => {
 *   // Implementation logic
 *   return ok(result);
 * });
 * ```
 */
export interface ImplementedContract<
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
  TDeps extends Record<string, any>,
  TOptions extends Record<string, any> = Record<string, never>,
  TErrors extends ReadonlyArray<new (...args: any[]) => TaggedError> = []
> {
  /** The input and output Zod schemas for validation */
  schemas: {
    input: TInput;
    output: TOutput;
  };
  /** Type information for TypeScript inference */
  types: {
    Input: InferSchema<TInput>;
    Output: InferSchema<TOutput>;
    Dependencies: TDeps;
    Options: TOptions;
    Error: ErrorUnion<TErrors>;
    Implementation: ImplementationFunction<
      InferSchema<TInput>,
      InferSchema<TOutput>,
      TDeps,
      TOptions,
      ErrorUnion<TErrors>
    >;
  };
  /** Array of error constructors that this contract can throw */
  errors: TErrors;
  /** The main implementation function */
  run: ImplementationFunction<
    InferSchema<TInput>,
    InferSchema<TOutput>,
    TDeps,
    TOptions,
    ErrorUnion<TErrors>
  >;
  /** Creates a curried version with dependencies pre-injected */
  withDependencies: (deps: TDeps) => CurriedImplementation<
    InferSchema<TInput>,
    InferSchema<TOutput>,
    TOptions,
    ErrorUnion<TErrors>
  >;
  /** Validates and parses input data using the input schema */
  validateInput: (input: unknown) => InferSchema<TInput>;
  /** Validates and parses output data using the output schema */
  validateOutput: (output: unknown) => InferSchema<TOutput>;
}

/**
 * Interface representing a contract definition without implementation.
 * 
 * A contract defines the interface, dependencies, and error types for an operation
 * but does not include the actual implementation logic.
 * 
 * @template TInput - The Zod schema type for input validation
 * @template TOutput - The Zod schema type for output validation
 * @template TDeps - The dependencies object type
 * @template TOptions - The options object type (defaults to empty record)
 * @template TErrors - Array of error constructor types that can be thrown
 * 
 * @example
 * ```typescript
 * const userContract: Contract<
 *   z.ZodObject<{ name: z.ZodString }>,
 *   z.ZodObject<{ id: z.ZodString, name: z.ZodString }>,
 *   { userRepo: UserRepository }
 * > = defineContract({
 *   input: z.object({ name: z.string() }),
 *   output: z.object({ id: z.string(), name: z.string() }),
 *   dependencies: {} as { userRepo: UserRepository }
 * });
 * ```
 */
export interface Contract<
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
  TDeps extends Record<string, any>,
  TOptions extends Record<string, any> = Record<string, never>,
  TErrors extends ReadonlyArray<new (...args: any[]) => TaggedError> = []
> {
  /** The input and output Zod schemas for validation */
  schemas: {
    input: TInput;
    output: TOutput;
  };
  /** Type information for TypeScript inference */
  types: {
    Input: InferSchema<TInput>;
    Output: InferSchema<TOutput>;
    Dependencies: TDeps;
    Options: TOptions;
    Error: ErrorUnion<TErrors>;
    Implementation: ImplementationFunction<
      InferSchema<TInput>,
      InferSchema<TOutput>,
      TDeps,
      TOptions,
      ErrorUnion<TErrors>
    >;
  };
  /** Array of error constructors that this contract can throw */
  errors: TErrors;
  /** Method to add an implementation to this contract */
  implementation: (
    impl: ImplementationFunction<
      InferSchema<TInput>,
      InferSchema<TOutput>,
      TDeps,
      TOptions,
      ErrorUnion<TErrors>
    >
  ) => ImplementedContract<TInput, TOutput, TDeps, TOptions, TErrors>;
}

/**
 * Creates a new contract definition with the specified input/output schemas,
 * dependencies, options, and possible error types.
 * 
 * This is the main entry point for defining contracts in the system. A contract
 * specifies the interface for an operation including its inputs, outputs,
 * dependencies, and error conditions.
 * 
 * @template TInput - The Zod schema type for input validation
 * @template TOutput - The Zod schema type for output validation
 * @template TDeps - The dependencies object type
 * @template TOptions - The options object type (defaults to empty record)
 * @template TErrors - Array of error constructor types (marked as const for literal types)
 * 
 * @param params - Configuration object for the contract
 * @param params.input - Zod schema for validating input data
 * @param params.output - Zod schema for validating output data
 * @param params.dependencies - Type definition for required dependencies
 * @param params.options - Optional type definition for configuration options
 * @param params.errors - Optional array of error constructors that can be thrown
 * 
 * @returns A contract instance that can be given an implementation
 * 
 * @example
 * ```typescript
 * // Basic contract
 * const createUserContract = defineContract({
 *   input: z.object({
 *     name: z.string(),
 *     email: z.string().email()
 *   }),
 *   output: z.object({
 *     id: z.string(),
 *     name: z.string(),
 *     email: z.string()
 *   }),
 *   dependencies: {} as { userRepo: UserRepository },
 *   options: {} as { sendWelcomeEmail?: boolean },
 *   errors: [UserAlreadyExistsError, ValidationError] as const
 * });
 * 
 * // Add implementation
 * const implementedContract = createUserContract.implementation(
 *   async ({ input, deps, options }) => {
 *     // Implementation logic here
 *     return ok(createdUser);
 *   }
 * );
 * ```
 */
export function defineContract<
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
  TDeps extends Record<string, any>,
  TOptions extends Record<string, any> = Record<string, never>,
  const TErrors extends ReadonlyArray<new (...args: any[]) => TaggedError> = []
>(params: {
  input: TInput;
  output: TOutput;
  dependencies: TDeps;
  options?: TOptions;
  errors?: TErrors;
}): Contract<TInput, TOutput, TDeps, TOptions, TErrors> {
  const errors = params.errors || ([] as unknown as TErrors);
  
  const contract: Contract<TInput, TOutput, TDeps, TOptions, TErrors> = {
    schemas: {
      input: params.input,
      output: params.output,
    },
    types: {
      Input: {} as InferSchema<TInput>,
      Output: {} as InferSchema<TOutput>,
      Dependencies: {} as TDeps,
      Options: {} as TOptions,
      Error: {} as ErrorUnion<TErrors>,
      Implementation: {} as ImplementationFunction<
        InferSchema<TInput>,
        InferSchema<TOutput>,
        TDeps,
        TOptions,
        ErrorUnion<TErrors>
      >,
    },
    errors,
    implementation: (impl) => {
      const implementedContract: ImplementedContract<TInput, TOutput, TDeps, TOptions, TErrors> = {
        ...contract,
        run: impl,
        withDependencies: (deps: TDeps) => {
          return (input, options) => impl({ input, deps, options });
        },
        validateInput: (input: unknown) => params.input.parse(input),
        validateOutput: (output: unknown) => params.output.parse(output),
      };
      return implementedContract;
    },
  };

  return contract;
}

export type { CurriedImplementation }