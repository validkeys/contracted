import { serviceFrom } from '../../../core/serviceFrom.ts';
import { createUserContract } from '../contracts/UserManager/index.ts';
import { createUser } from './commands/createUser.ts';
// Import other commands as you create them
// import { deleteUser } from './commands/deleteUser.ts';
// import { updateUser } from './commands/updateUser.ts';

/**
 * Creates a UserManager service with the provided dependencies.
 * 
 * This service provides user management operations including creation,
 * updating, deletion, and retrieval of users.
 */
export const createUserService = serviceFrom({
  createUser,
  // Add other commands here
  // deleteUser,
  // updateUser,
});

/**
 * Type for the UserManager service instance
 * Useful for dependency injection and testing
 */
export type UserService = ReturnType<typeof createUserService>;

/**
 * Type for the dependencies required by the UserManager service
 * Extracted from the contract's dependency type
 */
export type UserManagerDependencies = typeof createUserContract.types.Dependencies;

