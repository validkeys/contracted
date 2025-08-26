import { z } from 'zod';
import { Contract, ImplementedContract } from './defineContract';
import { TaggedError, ErrorUnion } from './errors';
import { ServiceWithContracts, CurriedService, MergeDependencies, MergeErrors } from './serviceFrom';

/**
 * Helper type that converts a record of Contracts to ImplementedContracts.
 * This is used to specify what implementations are required for a service contract.
 * 
 * @template T - Record of contract names to Contract instances
 * 
 * @example
 * ```typescript
 * type Implementations = ImplementedContractsFrom<{
 *   createUser: Contract<...>,
 *   updateUser: Contract<...>
 * }>;
 * // { createUser: ImplementedContract<...>, updateUser: ImplementedContract<...> }
 * ```
 */
export type ImplementedContractsFrom<T extends Record<string, Contract<any, any, any, any, any>>> = {
  [K in keyof T]: T[K] extends Contract<infer TInput, infer TOutput, infer TDeps, infer TOptions, infer TErrors>
    ? ImplementedContract<TInput, TOutput, TDeps, TOptions, TErrors>
    : never;
};

/**
 * Interface representing a service contract definition without implementations.
 * 
 * A service contract defines the collection of commands that make up a service
 * and provides type information that can be used before implementations exist.
 * This enables clean separation between contract definition and implementation.
 * 
 * @template T - Record of contract names to Contract instances
 * 
 * @example
 * ```typescript
 * const userServiceContract: ServiceContract<{
 *   createUser: Contract<...>,
 *   updateUser: Contract<...>
 * }> = defineService({
 *   createUser: createUserContract,
 *   updateUser: updateUserContract
 * });
 * ```
 */
export interface ServiceContract<
  T extends Record<string, Contract<any, any, any, any, any>>
> {
  /** The individual contracts that make up this service */
  contracts: T;
  
  /** Type information available at compile time */
  types: {
    /** The type of the runtime service instance */
    Service: ServiceWithContracts<ImplementedContractsFrom<T>>;
    /** The merged dependencies required by all commands */
    Dependencies: MergeDependencies<ImplementedContractsFrom<T>>;
    /** Union of all possible errors from all commands */
    Errors: MergeErrors<ImplementedContractsFrom<T>>;
    /** The original contracts for reference */
    Contracts: T;
  };
  
  /** Method to create a service factory from implementations */
  implementation: (
    implementations: ImplementedContractsFrom<T>
  ) => (deps: MergeDependencies<ImplementedContractsFrom<T>>) => ServiceWithContracts<ImplementedContractsFrom<T>>;
}

/**
 * Creates a service contract definition from a collection of individual contracts.
 * 
 * This function defines the structure and types for a service without requiring
 * implementations. It enables type-driven development where service interfaces
 * can be defined in a contracts folder and implemented separately in packages.
 * 
 * The pattern mirrors defineContract → contract.implementation:
 * - defineService → serviceContract.implementation
 * 
 * @template T - Record of contract names to Contract instances
 * 
 * @param contracts - Object mapping command names to contract definitions
 * 
 * @returns A service contract that can be implemented later
 * 
 * @example
 * ```typescript
 * // In contracts/UserManager/service.ts
 * export const userManagerServiceContract = defineService({
 *   createUser: createUserContract,
 *   updateUser: updateUserContract,
 *   deleteUser: deleteUserContract,
 *   getUser: getUserContract
 * });
 * 
 * // Types available immediately for other packages
 * export type UserManagerService = typeof userManagerServiceContract.types.Service;
 * export type UserManagerDeps = typeof userManagerServiceContract.types.Dependencies;
 * 
 * // In packages/UserManager/service.ts
 * import { userManagerServiceContract } from '../../contracts/UserManager/service';
 * 
 * export const createUserManagerService = userManagerServiceContract.implementation({
 *   createUser: createUserContract.implementation(createUserImpl),
 *   updateUser: updateUserContract.implementation(updateUserImpl),
 *   deleteUser: deleteUserContract.implementation(deleteUserImpl),
 *   getUser: getUserContract.implementation(getUserImpl)
 * });
 * 
 * // In other packages
 * import type { UserManagerService } from '../../contracts/UserManager/service';
 * 
 * function useUserManager(service: UserManagerService) {
 *   // Type-safe usage without importing implementation
 * }
 * ```
 */
export function defineService<
  T extends Record<string, Contract<any, any, any, any, any>>
>(
  contracts: T
): ServiceContract<T> {
  const serviceContract: ServiceContract<T> = {
    contracts,
    types: {
      Service: {} as ServiceWithContracts<ImplementedContractsFrom<T>>,
      Dependencies: {} as MergeDependencies<ImplementedContractsFrom<T>>,
      Errors: {} as MergeErrors<ImplementedContractsFrom<T>>,
      Contracts: {} as T,
    },
    implementation: (implementations: ImplementedContractsFrom<T>) => {
      // Validate that all required contracts have implementations
      for (const contractName in contracts) {
        if (!(contractName in implementations)) {
          throw new Error(`Missing implementation for contract: ${contractName}`);
        }
      }
      
      // Return a service factory function (same signature as serviceFrom)
      return (deps: MergeDependencies<ImplementedContractsFrom<T>>) => {
        const service = {} as ServiceWithContracts<ImplementedContractsFrom<T>>;
        
        for (const [commandName, implementation] of Object.entries(implementations)) {
          // Create a curried version of each command with the provided dependencies
          const curriedCommand = implementation.withDependencies(deps);
          
          // Build the service command with all contract metadata but curried run
          service[commandName as keyof ImplementedContractsFrom<T>] = {
            schemas: implementation.schemas,
            types: implementation.types,
            errors: implementation.errors,
            validateInput: implementation.validateInput,
            validateOutput: implementation.validateOutput,
            run: curriedCommand,
          } as any;
        }
        
        return service;
      };
    },
  };

  return serviceContract;
}