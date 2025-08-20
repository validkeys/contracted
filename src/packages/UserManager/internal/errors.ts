import { defineError } from '../../../core/errors.ts';

// Correct usage: create error classes by calling defineError with tag, message, and type parameter.
export const UserAlreadyExistsError = defineError<'USER_ALREADY_EXISTS', { email: string }>(
  'USER_ALREADY_EXISTS',
  'User with this email already exists'
);

export const UserNotFoundError = defineError<'USER_NOT_FOUND', { userId: string }>(
  'USER_NOT_FOUND',
  'User not found'
);

export const InvalidUserDataError = defineError<'INVALID_USER_DATA', { field: string; reason: string }>(
  'INVALID_USER_DATA',
  'Invalid user data provided'
);

export const UserRepositoryError = defineError<'USER_REPOSITORY_ERROR', { operation: string; details?: string }>(
  'USER_REPOSITORY_ERROR',
  'Database operation failed'
);

export const InsufficientPermissionsError = defineError<'INSUFFICIENT_PERMISSIONS', { requiredPermission: string; userId: string }>(
  'INSUFFICIENT_PERMISSIONS',
  'User does not have required permissions'
);

// Export as const array for contract definition
export const createUserErrors = [
  UserAlreadyExistsError,
  InvalidUserDataError,
  UserRepositoryError,
] as const;

export const deleteUserErrors = [
  UserNotFoundError,
  InsufficientPermissionsError,
  UserRepositoryError,
] as const;

export const allUserErrors = [
  UserAlreadyExistsError,
  UserNotFoundError,
  InvalidUserDataError,
  UserRepositoryError,
  InsufficientPermissionsError,
] as const;