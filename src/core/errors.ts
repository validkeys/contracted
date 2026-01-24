import { z, type ZodError } from 'zod';

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
 * System-level error thrown when input or output validation fails.
 * This error is automatically added to all contracts using the `implementation()` method.
 * 
 * @property {ZodError} zodError - The complete ZodError instance from Zod validation.
 *   Provides full access to all Zod error information including nested errors,
 *   union errors, refinement errors, and all Zod error methods (format(), flatten(), etc.).
 *   Use this when you need detailed error introspection or want to use Zod's error formatting utilities.
 * 
 * @property {Array} errors - Simplified array of validation errors with path, message, and code.
 *   Provided for backward compatibility and convenient access to basic error information.
 *   Each error contains:
 *   - path: Array representing the path to the invalid field (e.g., ['user', 'email'])
 *   - message: Human-readable error message
 *   - code: Zod error code (e.g., 'invalid_type', 'too_small', 'invalid_string')
 * 
 * @property {string} phase - Indicates whether validation failed during 'input' or 'output' validation
 * @property {string} message - Human-readable summary of all validation errors
 * 
 * @example
 * ```typescript
 * if (result.isErr() && result.error._tag === 'VALIDATION_ERROR') {
 *   // Access simplified errors (backward compatible)
 *   result.error.data.errors.forEach(e => {
 *     console.log(`${e.path.join('.')}: ${e.message}`);
 *   });
 * 
 *   // Access full ZodError for advanced use cases
 *   const formatted = result.error.data.zodError.format();
 *   console.log(formatted);
 * 
 *   // Use ZodError methods
 *   const flattened = result.error.data.zodError.flatten();
 *   console.log(flattened.fieldErrors);
 * }
 * ```
 */
export const ValidationError = defineError<
  'VALIDATION_ERROR',
  {
    /** The complete ZodError instance with full validation details and error methods */
    zodError: ZodError;
    /** Whether validation failed during 'input' or 'output' phase */
    phase: 'input' | 'output';
    /** Simplified array of error objects for convenient access (backward compatible) */
    errors: Array<{
      path: (string | number)[];
      message: string;
      code: string;
    }>;
    /** Human-readable summary message of all validation errors */
    message: string;
  }
>('VALIDATION_ERROR', 'Schema validation failed');

/**
 * Helper function to convert a ZodError to a ValidationError instance.
 * 
 * This function transforms Zod validation errors into our tagged error format while
 * preserving all error information. It provides both:
 * 1. The complete ZodError instance for advanced error handling and introspection
 * 2. A simplified errors array for convenient access to basic error information
 * 
 * The simplified errors array maintains backward compatibility with existing code
 * while the zodError field provides full access to Zod's rich error information
 * including nested errors, union errors, refinement errors, and utility methods.
 * 
 * @param zodError - The ZodError instance from Zod schema validation
 * @param phase - Whether this error occurred during 'input' or 'output' validation
 * 
 * @returns A ValidationError instance containing:
 *   - zodError: The complete ZodError for advanced use cases
 *   - errors: Simplified array with path, message, and code for each issue
 *   - phase: 'input' or 'output' to indicate validation phase
 *   - message: Human-readable summary of all validation errors
 * 
 * @example
 * ```typescript
 * const zodError = schema.safeParse(data).error;
 * const validationError = zodErrorToValidationError(zodError, 'input');
 * 
 * // Access simplified errors
 * validationError.data.errors.forEach(e => console.log(e.path, e.message));
 * 
 * // Use ZodError methods
 * const formatted = validationError.data.zodError.format();
 * const flattened = validationError.data.zodError.flatten();
 * ```
 */
export function zodErrorToValidationError(
  zodError: z.ZodError,
  phase: 'input' | 'output'
): InstanceType<typeof ValidationError> {
  return new ValidationError({
    zodError,
    phase,
    errors: zodError.issues.map(e => ({
      path: e.path.map(p => (typeof p === 'symbol' ? String(p) : p)),
      message: e.message,
      code: e.code,
    })),
    message: `${phase} validation failed: ${zodError.issues.map(e => e.message).join(', ')}`,
  });
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