import { z } from 'zod';
import { ErrorUnion, TaggedError } from './errors';
import {
  CurriedImplementation,
  ImplementationFunction,
  InferSchema
} from './types';

// Contract with implementation
export interface ImplementedContract<
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
  TDeps extends Record<string, any>,
  TOptions extends Record<string, any> = Record<string, never>,
  TErrors extends ReadonlyArray<new (...args: any[]) => TaggedError> = []
> {
  schemas: {
    input: TInput;
    output: TOutput;
  };
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
  errors: TErrors;
  run: ImplementationFunction<
    InferSchema<TInput>,
    InferSchema<TOutput>,
    TDeps,
    TOptions,
    ErrorUnion<TErrors>
  >;
  withDependencies: (deps: TDeps) => CurriedImplementation<
    InferSchema<TInput>,
    InferSchema<TOutput>,
    TOptions,
    ErrorUnion<TErrors>
  >;
  validateInput: (input: unknown) => InferSchema<TInput>;
  validateOutput: (output: unknown) => InferSchema<TOutput>;
}

// Base contract without implementation
export interface Contract<
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
  TDeps extends Record<string, any>,
  TOptions extends Record<string, any> = Record<string, never>,
  TErrors extends ReadonlyArray<new (...args: any[]) => TaggedError> = []
> {
  schemas: {
    input: TInput;
    output: TOutput;
  };
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
  errors: TErrors;
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

// Main function with errors parameter
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