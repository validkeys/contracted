import { userManagerServiceContract, UserManagerService, UserManagerDependencies } from '../contracts/UserManager/service.ts';
import { createUser } from './commands/createUser.ts';
// Import other commands as you create them
// import { deleteUser } from './commands/deleteUser.ts';
// import { updateUser } from './commands/updateUser.ts';

/**
 * Creates a UserManager service with the provided dependencies.
 * 
 * This service implements the UserManagerServiceContract and provides 
 * user management operations including creation, updating, deletion, and retrieval of users.
 */
export const createUserService = userManagerServiceContract.implementation({
  createUser,
  // Add other commands here
  // deleteUser,
  // updateUser,
});

/**
 * Type for the UserManager service instance
 * Imported from the service contract for consistency
 */
export type UserService = UserManagerService;

/**
 * Type for the dependencies required by the UserManager service
 * Imported from the service contract for consistency
 */
export type { UserManagerDependencies };

