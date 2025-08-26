import { z } from 'zod';
import { Result } from 'neverthrow';
import { TaggedError } from './errors';

/**
 * Utility type that extracts the inferred TypeScript type from a Zod schema.
 * 
 * @template T - The Zod schema type
 * 
 * @example
 * ```typescript
 * const userSchema = z.object({ name: z.string(), age: z.number() });
 * type User = InferSchema<typeof userSchema>; // { name: string; age: number }
 * ```
 */
export type InferSchema<T extends z.ZodType> = z.infer<T>;

/**
 * Context object passed to implementation functions containing all necessary data.
 * 
 * @template TInput - The input data type
 * @template TDeps - The dependencies object type
 * @template TOptions - The options object type (defaults to empty record)
 * 
 * @example
 * ```typescript
 * type Context = ImplementationContext<
 *   { userId: string },
 *   { userRepo: UserRepository },
 *   { includeDeleted?: boolean }
 * >;
 * // Context = {
 * //   input: { userId: string };
 * //   deps: { userRepo: UserRepository };
 * //   options?: { includeDeleted?: boolean };
 * // }
 * ```
 */
export type ImplementationContext<
  TInput,
  TDeps extends Record<string, any>,
  TOptions extends Record<string, any> = Record<string, never>
> = {
  /** The validated input data for the operation */
  input: TInput;
  /** Injected dependencies required for the operation */
  deps: TDeps;
  /** Optional configuration parameters */
  options?: TOptions;
};

/**
 * Type definition for contract implementation functions that return neverthrow Results.
 * 
 * Implementation functions receive a context object and return a Promise
 * that resolves to a Result containing either the output or an error.
 * 
 * @template TInput - The input data type
 * @template TOutput - The output data type
 * @template TDeps - The dependencies object type
 * @template TOptions - The options object type (defaults to empty record)
 * @template TError - The error type that can be thrown (extends TaggedError)
 * 
 * @example
 * ```typescript
 * const createUser: ImplementationFunction<
 *   { name: string; email: string },
 *   { id: string; name: string; email: string },
 *   { userRepo: UserRepository },
 *   { sendWelcomeEmail?: boolean },
 *   UserAlreadyExistsError | ValidationError
 * > = async ({ input, deps, options }) => {
 *   // Implementation logic here
 *   return ok(createdUser);
 * };
 * ```
 */
export type ImplementationFunction<
  TInput,
  TOutput,
  TDeps extends Record<string, any>,
  TOptions extends Record<string, any> = Record<string, never>,
  TError extends TaggedError = TaggedError
> = (
  context: ImplementationContext<TInput, TDeps, TOptions>
) => Promise<Result<TOutput, TError>>;

/**
 * Type definition for unsafe contract implementation functions that return raw outputs.
 * 
 * These functions can return the output directly or throw errors, which will be
 * automatically wrapped in neverthrow Results by the contract system.
 * 
 * @template TInput - The input data type
 * @template TOutput - The output data type
 * @template TDeps - The dependencies object type
 * @template TOptions - The options object type (defaults to empty record)
 * 
 * @example
 * ```typescript
 * const createUser: UnsafeImplementationFunction<
 *   { name: string; email: string },
 *   { id: string; name: string; email: string },
 *   { userRepo: UserRepository },
 *   { sendWelcomeEmail?: boolean }
 * > = async ({ input, deps, options }) => {
 *   // Can return output directly or throw errors
 *   return createdUser; // or throw new MyError()
 * };
 * ```
 */
export type UnsafeImplementationFunction<
  TInput,
  TOutput,
  TDeps extends Record<string, any>,
  TOptions extends Record<string, any> = Record<string, never>
> = (
  context: ImplementationContext<TInput, TDeps, TOptions>
) => Promise<TOutput>;

/**
 * Type for a curried implementation function with dependencies already injected.
 * 
 * This is the result of calling `withDependencies` on a contract, creating
 * a function that only requires input and options to execute.
 * 
 * @template TInput - The input data type
 * @template TOutput - The output data type
 * @template TOptions - The options object type (defaults to empty record)
 * @template TError - The error type that can be thrown (extends TaggedError)
 * 
 * @example
 * ```typescript
 * const userService = userContract.withDependencies({ userRepo });
 * 
 * // userService is now a CurriedImplementation
 * const result = await userService(
 *   { name: "John", email: "john@example.com" },
 *   { sendWelcomeEmail: true }
 * );
 * ```
 */
export type CurriedImplementation<
  TInput,
  TOutput,
  TOptions extends Record<string, any> = Record<string, never>,
  TError extends TaggedError = TaggedError
> = (
  input: TInput,
  options?: TOptions
) => Promise<Result<TOutput, TError>>;