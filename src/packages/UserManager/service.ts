import { serviceFrom } from '../../core/serviceFrom.ts';
import { createUser } from './commands/createUser.ts';
// Import other commands as you create them
// import { deleteUser } from '../commands/deleteUser';
// import { updateUser } from '../commands/updateUser';

// Create the service factory
export const createUserService = serviceFrom({
  createUser,
  // Add other commands here
  // deleteUser,
  // updateUser,
});

// Type for the service (useful for dependency injection)
export type UserService = ReturnType<typeof createUserService>;

