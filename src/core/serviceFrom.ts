import { z } from 'zod';
import { ImplementedContract, CurriedImplementation } from './defineContract';
import { ErrorUnion } from './errors';

/**
 * Helper type that extracts the dependency types from a contract.
 * 
 * @template T - The implemented contract type
 * 
 * @example
 * ```typescript
 * type Deps = ExtractDependencies<CreateUserContract>; 
 * // { userRepo: UserRepository, emailService: EmailService }
 * ```
 */
type ExtractDependencies<T> = T extends ImplementedContract<any, any, infer TDeps, any, any> ? TDeps : never;

/**
 * Helper type that extracts the error types from a contract.
 * 
 * @template T - The implemented contract type
 * 
 * @example
 * ```typescript
 * type Errors = ExtractErrors<CreateUserContract>;
 * // [UserAlreadyExistsError, ValidationError]
 * ```
 */
type ExtractErrors<T> = T extends ImplementedContract<any, any, any, any, infer TErrors> ? TErrors : never;

/**
 * Helper type that merges all dependencies from multiple contracts into a single type.
 * 
 * This creates an intersection of all dependency types from the contracts in the service.
 * 
 * @template T - Record of contract names to implemented contracts
 * 
 * @example
 * ```typescript
 * type AllDeps = MergeDependencies<{
 *   createUser: CreateUserContract,
 *   deleteUser: DeleteUserContract
 * }>;
 * // { userRepo: UserRepository } & { userRepo: UserRepository, auditService: AuditService }
 * ```
 */
type MergeDependencies<T extends Record<string, ImplementedContract<any, any, any, any, any>>> = {
  [K in keyof T]: ExtractDependencies<T[K]>
}[keyof T];

/**
 * Helper type that merges all error types from multiple contracts into a union.
 * 
 * @template T - Record of contract names to implemented contracts
 * 
 * @example
 * ```typescript
 * type AllErrors = MergeErrors<{
 *   createUser: CreateUserContract,
 *   deleteUser: DeleteUserContract
 * }>;
 * // UserAlreadyExistsError | UserNotFoundError | ValidationError
 * ```
 */
type MergeErrors<T extends Record<string, ImplementedContract<any, any, any, any, any>>> = 
  ErrorUnion<ExtractErrors<T[keyof T]>>;

/**
 * Type for a service that includes all contract metadata along with curried run functions.
 * 
 * Each command in the service retains its contract metadata (schemas, types, errors)
 * but has its run function curried with dependencies already injected.
 * 
 * @template T - Record of contract names to implemented contracts
 */
type ServiceWithContracts<T extends Record<string, ImplementedContract<any, any, any, any, any>>> = {
  [K in keyof T]: T[K] extends ImplementedContract<infer TInput, infer TOutput, infer TDeps, infer TOptions, infer TErrors>
    ? Omit<T[K], 'run' | 'withDependencies'> & {
        run: CurriedImplementation<z.infer<TInput>, z.infer<TOutput>, TOptions, ErrorUnion<TErrors>>;
      }
    : never
};

/**
 * Type for a simplified service that only includes the curried execution functions.
 * 
 * This provides a cleaner API when you only need to execute commands and don't
 * need access to the contract metadata.
 * 
 * @template T - Record of contract names to implemented contracts
 */
type CurriedService<T extends Record<string, ImplementedContract<any, any, any, any, any>>> = {
  [K in keyof T]: T[K] extends ImplementedContract<infer TInput, infer TOutput, any, infer TOptions, infer TErrors>
    ? CurriedImplementation<z.infer<TInput>, z.infer<TOutput>, TOptions, ErrorUnion<TErrors>>
    : never
};

/**
 * Creates a service factory function from a collection of implemented contracts.
 * 
 * This function takes a record of implemented contracts and returns a function
 * that accepts dependencies and produces a service with all commands curried
 * with those dependencies.
 * 
 * The resulting service retains all contract metadata (schemas, types, errors)
 * while providing curried execution functions.
 * 
 * @template T - Record of contract names to implemented contracts
 * 
 * @param commands - Object mapping command names to implemented contracts
 * 
 * @returns Function that accepts dependencies and returns a service
 * 
 * @example
 * ```typescript
 * // Define contracts
 * const userContracts = {
 *   createUser: createUserContract.implementation(createUserImpl),
 *   deleteUser: deleteUserContract.implementation(deleteUserImpl),
 *   getUser: getUserContract.implementation(getUserImpl)
 * };
 * 
 * // Create service factory
 * const createUserService = serviceFrom(userContracts);
 * 
 * // Create service instance with dependencies
 * const userService = createUserService({
 *   userRepo: new UserRepository(),
 *   emailService: new EmailService()
 * });
 * 
 * // Use the service
 * const result = await userService.createUser.run(
 *   { name: "John", email: "john@example.com" },
 *   { sendWelcomeEmail: true }
 * );
 * 
 * // Access contract metadata
 * console.log(userService.createUser.schemas.input);
 * console.log(userService.createUser.errors);
 * ```
 */
export function serviceFrom<
  T extends Record<string, ImplementedContract<any, any, any, any, any>>
>(
  commands: T
): (deps: MergeDependencies<T>) => ServiceWithContracts<T> {
  return (deps: MergeDependencies<T>) => {
    const service = {} as ServiceWithContracts<T>;
    
    for (const [commandName, contract] of Object.entries(commands)) {
      // Create a curried version of each command with the provided dependencies
      const curriedCommand = contract.withDependencies(deps);
      
      // Build the service command with all contract metadata but curried run
      service[commandName as keyof T] = {
        schemas: contract.schemas,
        types: contract.types,
        errors: contract.errors,
        validateInput: contract.validateInput,
        validateOutput: contract.validateOutput,
        run: curriedCommand,
      } as any;
    }
    
    return service;
  };
}

/**
 * Creates a simplified service factory function from a collection of implemented contracts.
 * 
 * This function is similar to `serviceFrom` but returns only the curried execution
 * functions without the contract metadata, providing a cleaner API when metadata
 * is not needed.
 * 
 * @template T - Record of contract names to implemented contracts
 * 
 * @param commands - Object mapping command names to implemented contracts
 * 
 * @returns Function that accepts dependencies and returns a simplified service
 * 
 * @example
 * ```typescript
 * // Create simplified service factory
 * const createUserService = serviceFromSimple(userContracts);
 * 
 * // Create service instance with dependencies
 * const userService = createUserService({
 *   userRepo: new UserRepository(),
 *   emailService: new EmailService()
 * });
 * 
 * // Use the service (cleaner API)
 * const result = await userService.createUser(
 *   { name: "John", email: "john@example.com" },
 *   { sendWelcomeEmail: true }
 * );
 * ```
 */
export function serviceFromSimple<
  T extends Record<string, ImplementedContract<any, any, any, any, any>>
>(
  commands: T
): (deps: MergeDependencies<T>) => CurriedService<T> {
  return (deps: MergeDependencies<T>) => {
    const service = {} as CurriedService<T>;
    
    for (const [commandName, contract] of Object.entries(commands)) {
      service[commandName as keyof T] = contract.withDependencies(deps) as any;
    }
    
    return service;
  };
}

/**
 * Helper type to extract all dependency types required by a service.
 * 
 * @template T - Record of contract names to implemented contracts
 * 
 * @example
 * ```typescript
 * type UserServiceDeps = ServiceDependencies<typeof userContracts>;
 * // { userRepo: UserRepository, emailService: EmailService }
 * ```
 */
export type ServiceDependencies<T extends Record<string, ImplementedContract<any, any, any, any, any>>> = MergeDependencies<T>;

/**
 * Helper type to extract all possible error types from a service.
 * 
 * @template T - Record of contract names to implemented contracts
 * 
 * @example
 * ```typescript
 * type UserServiceErrors = ServiceErrors<typeof userContracts>;
 * // UserAlreadyExistsError | UserNotFoundError | ValidationError
 * ```
 */
export type ServiceErrors<T extends Record<string, ImplementedContract<any, any, any, any, any>>> = MergeErrors<T>;