import { z } from 'zod';

/**
 * Base class for all tagged errors in the contract system.
 * 
 * Tagged errors provide a discriminated union pattern for error handling,
 * allowing for exhaustive pattern matching and type-safe error handling.
 * 
 * @template TTag - The string literal tag that identifies this error type
 * 
 * @example
 * ```typescript
 * class UserNotFoundError extends TaggedError<'USER_NOT_FOUND'> {
 *   readonly _tag = 'USER_NOT_FOUND';
 *   
 *   constructor(userId: string, cause?: unknown) {
 *     super(`User with ID ${userId} not found`, cause);
 *   }
 * }
 * ```
 */
export abstract class TaggedError<TTag extends string = string> extends Error {
  /** The tag that uniquely identifies this error type */
  abstract readonly _tag: TTag;
  
  /**
   * Creates a new tagged error instance.
   * 
   * @param message - The error message
   * @param cause - Optional underlying cause of the error
   */
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Helper type that extracts the tag from a TaggedError type.
 * 
 * @template T - The TaggedError type to extract the tag from
 * 
 * @example
 * ```typescript
 * type Tag = ErrorTag<UserNotFoundError>; // 'USER_NOT_FOUND'
 * ```
 */
export type ErrorTag<T> = T extends TaggedError<infer TTag> ? TTag : never;

/**
 * Helper type that creates a discriminated union of error instances from an array of error constructors.
 * 
 * This type takes an array of error constructor types and creates a union of the
 * actual error instances that those constructors would create.
 * 
 * @template T - A readonly array of error constructor types
 * 
 * @example
 * ```typescript
 * const errors = [UserNotFoundError, ValidationError] as const;
 * type PossibleErrors = ErrorUnion<typeof errors>; 
 * // UserNotFoundError | ValidationError
 * ```
 */
export type ErrorUnion<T extends ReadonlyArray<new (...args: any[]) => TaggedError>> = 
  T extends ReadonlyArray<infer E> 
    ? E extends new (...args: any[]) => infer Instance 
      ? Instance 
      : never 
    : never;

/**
 * Factory function for creating tagged error classes with a specific tag and data structure.
 * 
 * This function provides a convenient way to create error classes that follow
 * the tagged error pattern with typed data payloads.
 * 
 * @template TTag - The string literal tag for the error
 * @template TData - The type of data this error carries (defaults to empty object)
 * 
 * @param tag - The unique tag identifier for this error type
 * @param defaultMessage - Optional default message when none is provided
 * 
 * @returns A new error class constructor that extends TaggedError
 * 
 * @example
 * ```typescript
 * const UserNotFoundError = defineError<'USER_NOT_FOUND', { userId: string }>(
 *   'USER_NOT_FOUND',
 *   'The requested user could not be found'
 * );
 * 
 * // Usage:
 * throw new UserNotFoundError(
 *   { userId: '123' },
 *   'User with ID 123 not found'
 * );
 * ```
 */
export function defineError<TTag extends string, TData extends Record<string, any> = {}>(
  tag: TTag,
  defaultMessage?: string
) {
  return class extends TaggedError<TTag> {
    readonly _tag = tag;
    
    /**
     * Creates a new instance of this error.
     * 
     * @param data - The typed data payload for this error
     * @param message - Optional custom message (uses default if not provided)
     * @param cause - Optional underlying cause of the error
     */
    constructor(
      public readonly data: TData,
      message?: string,
      cause?: unknown
    ) {
      super(message || defaultMessage || `Error: ${tag}`, cause);
    }
  };
}

/**
 * Utility function for exhaustive pattern matching on tagged errors.
 * 
 * This function ensures that all possible error types are handled and provides
 * type safety by requiring a handler for each error tag in the union.
 * 
 * @template TError - The tagged error union type
 * @template TResult - The return type of the handler functions
 * 
 * @param error - The error instance to match against
 * @param handlers - Object with handler functions for each possible error tag
 * 
 * @returns The result of calling the appropriate handler function
 * 
 * @throws Error if no handler is found for the error's tag
 * 
 * @example
 * ```typescript
 * const result = matchError(error, {
 *   USER_NOT_FOUND: (err) => `User ${err.data.userId} not found`,
 *   VALIDATION_ERROR: (err) => `Invalid ${err.data.field}: ${err.data.reason}`,
 *   NETWORK_ERROR: (err) => 'Network connection failed'
 * });
 * ```
 */
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