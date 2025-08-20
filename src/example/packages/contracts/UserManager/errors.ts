import { defineError } from '../../../../core/errors.ts';

/**
 * Error thrown when attempting to create a user with an email that already exists
 */
export const UserAlreadyExistsError = defineError<'USER_ALREADY_EXISTS', { email: string }>(
  'USER_ALREADY_EXISTS',
  'User with this email already exists'
);

/**
 * Error thrown when a requested user cannot be found
 */
export const UserNotFoundError = defineError<'USER_NOT_FOUND', { userId: string }>(
  'USER_NOT_FOUND',
  'User not found'
);

/**
 * Error thrown when user data fails validation
 */
export const InvalidUserDataError = defineError<'INVALID_USER_DATA', { field: string; reason: string }>(
  'INVALID_USER_DATA',
  'Invalid user data provided'
);

/**
 * Error thrown when database operations fail
 */
export const UserRepositoryError = defineError<'USER_REPOSITORY_ERROR', { operation: string; details?: string }>(
  'USER_REPOSITORY_ERROR',
  'Database operation failed'
);

/**
 * Error thrown when user lacks required permissions
 */
export const InsufficientPermissionsError = defineError<'INSUFFICIENT_PERMISSIONS', { requiredPermission: string; userId: string }>(
  'INSUFFICIENT_PERMISSIONS',
  'User does not have required permissions'
);

/**
 * Errors that can be thrown by the createUser command
 */
export const createUserErrors = [
  UserAlreadyExistsError,
  InvalidUserDataError,
  UserRepositoryError,
] as const;

/**
 * Errors that can be thrown by the deleteUser command
 */
export const deleteUserErrors = [
  UserNotFoundError,
  InsufficientPermissionsError,
  UserRepositoryError,
] as const;

/**
 * All possible user-related errors
 */
export const allUserErrors = [
  UserAlreadyExistsError,
  UserNotFoundError,
  InvalidUserDataError,
  UserRepositoryError,
  InsufficientPermissionsError,
] as const;
