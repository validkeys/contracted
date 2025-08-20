import { z } from 'zod';

// Base tagged error class
export abstract class TaggedError<TTag extends string = string> extends Error {
  abstract readonly _tag: TTag;
  
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
  }
}

// Helper type to extract tag from error
export type ErrorTag<T> = T extends TaggedError<infer TTag> ? TTag : never;

// Helper type to create discriminated union of errors
export type ErrorUnion<T extends ReadonlyArray<new (...args: any[]) => TaggedError>> = 
  T extends ReadonlyArray<infer E> 
    ? E extends new (...args: any[]) => infer Instance 
      ? Instance 
      : never 
    : never;

// Error factory helper
export function defineError<TTag extends string, TData extends Record<string, any> = {}>(
  tag: TTag,
  defaultMessage?: string
) {
  return class extends TaggedError<TTag> {
    readonly _tag = tag;
    
    constructor(
      public readonly data: TData,
      message?: string,
      cause?: unknown
    ) {
      super(message || defaultMessage || `Error: ${tag}`, cause);
    }
  };
}

// Matcher function for exhaustive error handling
export function matchError<
  TError extends TaggedError,
  TResult
>(
  error: TError,
  handlers: {
    [K in TError['_tag']]: (error: Extract<TError, { _tag: K }>) => TResult;
  }
): TResult {
  const handler = handlers[error._tag as TError['_tag']];
  if (!handler) {
    throw new Error(`No handler for error tag: ${error._tag}`);
  }
  return handler(error as any);
}