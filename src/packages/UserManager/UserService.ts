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

// Example of creating the service with all dependencies
export function initializeUserService() {
  return createUserService({
    userRepository: {
      save: async (user: any) => {
        console.log('Saving user to database:', user);
        // Actual database logic here
      },
      findByEmail: async (email: string) => {
        console.log('Finding user by email:', email);
        // Return null if not found
        return null;
      },
    },
    idGenerator: {
      generate: () => Math.random().toString(36).substring(7),
    },
    logger: {
      info: (message: string, data?: any) => {
        console.log(`[INFO] ${message}`, data || '');
      },
      error: (message: string, error: Error) => {
        console.error(`[ERROR] ${message}`, error);
      },
    },
  });
}