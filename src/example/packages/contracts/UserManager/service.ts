import { defineService } from '../../../../core/defineService';
import { createUserContract } from './contracts';

/**
 * Service contract for the User Manager service.
 * 
 * This defines the complete service interface with all commands and their types.
 * The service contract can be used by other packages to implement or depend on
 * the User Manager service without importing the actual implementation.
 */
export const userManagerServiceContract = defineService({
  createUser: createUserContract,
});

// Export types for use in other packages
export type UserManagerService = typeof userManagerServiceContract.types.Service;
export type UserManagerDependencies = typeof userManagerServiceContract.types.Dependencies;
export type UserManagerErrors = typeof userManagerServiceContract.types.Errors;