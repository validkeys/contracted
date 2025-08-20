import { z } from 'zod';
import { Result } from 'neverthrow';
import { TaggedError } from './errors';

// Utility type to extract inferred type from Zod schema
export type InferSchema<T extends z.ZodType> = z.infer<T>;

// Implementation context type
export type ImplementationContext<
  TInput,
  TDeps extends Record<string, any>,
  TOptions extends Record<string, any> = Record<string, never>
> = {
  input: TInput;
  deps: TDeps;
  options?: TOptions;
};

// Implementation function type with specific error types
export type ImplementationFunction<
  TInput,
  TOutput,
  TDeps extends Record<string, any>,
  TOptions extends Record<string, any> = Record<string, never>,
  TError extends TaggedError = TaggedError
> = (
  context: ImplementationContext<TInput, TDeps, TOptions>
) => Promise<Result<TOutput, TError>>;

// Curried implementation type
export type CurriedImplementation<
  TInput,
  TOutput,
  TOptions extends Record<string, any> = Record<string, never>,
  TError extends TaggedError = TaggedError
> = (
  input: TInput,
  options?: TOptions
) => Promise<Result<TOutput, TError>>;