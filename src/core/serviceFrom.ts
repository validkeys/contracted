import { z } from 'zod';
import { ImplementedContract, CurriedImplementation } from './defineContract';
import { ErrorUnion } from './errors';
import { Namespace, NAMESPACE_TAG } from './defineNamespace';

// ============================================================================
// SHARED ALIASES
// ============================================================================

/** Shorthand for a fully-parameterized ImplementedContract */
type AnyImplementedContract = ImplementedContract<any, any, any, any, any>;

/** Shorthand for a Namespace whose contracts are ImplementedContracts */
type AnyNamespace = Namespace<Record<string, AnyImplementedContract>>;

/** Union that covers both flat commands and namespace values */
export type ServiceEntry = AnyImplementedContract | AnyNamespace;

// ============================================================================
// HELPER TYPES
// ============================================================================

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
 * Utility type that converts a union type to an intersection type.
 *
 * This leverages TypeScript's contravariance in function parameter positions
 * to transform union types into intersections.
 *
 * @template U - The union type to convert
 *
 * @example
 * ```typescript
 * type Union = { a: string } | { b: number };
 * type Intersection = UnionToIntersection<Union>;
 * // Result: { a: string } & { b: number }
 * ```
 */
type UnionToIntersection<U> =
  (U extends any ? (k: U) => void : never) extends
  (k: infer I) => void ? I : never;

/**
 * Extracts all dependency types from a single service entry value.
 *
 * - For a flat `ImplementedContract`: extracts its `TDeps`.
 * - For a `Namespace`: extracts deps from every inner contract.
 */
type ExtractEntryDependencies<E> =
  E extends Namespace<infer NS>
    ? ExtractDependencies<NS[keyof NS]>
    : ExtractDependencies<E>;

/**
 * Extracts all error tuple types from a single service entry value.
 *
 * - For a flat `ImplementedContract`: extracts its `TErrors`.
 * - For a `Namespace`: extracts errors from every inner contract.
 */
type ExtractEntryErrors<E> =
  E extends Namespace<infer NS>
    ? ExtractErrors<NS[keyof NS]>
    : ExtractErrors<E>;

// ============================================================================
// MERGE TYPES (exported — used by defineService.ts and other consumers)
// ============================================================================

/**
 * Helper type that merges all dependencies from multiple contracts (and namespaces)
 * into a single type.
 *
 * This creates an intersection of all dependency types from every command in the
 * service, including commands nested inside namespaces.
 *
 * @template T - Record of service entries (implemented contracts or namespaces)
 *
 * @example
 * ```typescript
 * type AllDeps = MergeDependencies<{
 *   createUser: CreateUserContract,       // requires: { userRepo, logger }
 *   users: Namespace<{                    // requires: { idGenerator }
 *     generateId: GenerateIdContract
 *   }>
 * }>;
 * // Result: { userRepo: ..., logger: ..., idGenerator: ... }
 * ```
 */
export type MergeDependencies<T extends Record<string, ServiceEntry>> =
  UnionToIntersection<ExtractEntryDependencies<T[keyof T]>>;

/**
 * Helper type that merges all error types from multiple contracts (and namespaces)
 * into a union.
 * 
 * @template T - Record of service entries (implemented contracts or namespaces)
 * 
 * @example
 * ```typescript
 * type AllErrors = MergeErrors<{
 *   createUser: CreateUserContract,
 *   users: Namespace<{ get: GetUserContract }>
 * }>;
 * // UserAlreadyExistsError | UserNotFoundError | ValidationError
 * ```
 */
export type MergeErrors<T extends Record<string, ServiceEntry>> = 
  ErrorUnion<ExtractEntryErrors<T[keyof T]>>;

// ============================================================================
// SERVICE SHAPE TYPES
// ============================================================================

/**
 * Produces the curried shape for a single `ImplementedContract` —
 * all metadata preserved, `run` curried.
 */
type FlatServiceEntry<C extends AnyImplementedContract> =
  C extends ImplementedContract<infer TInput, infer TOutput, any, infer TOptions, infer TErrors>
    ? Omit<C, 'run' | 'withDependencies'> & {
        run: CurriedImplementation<z.infer<TInput>, z.infer<TOutput>, TOptions, ErrorUnion<TErrors>>;
      }
    : never;

/**
 * Produces the curried shape for a single `ImplementedContract` for
 * the simple (metadata-free) variant.
 */
type FlatSimpleEntry<C extends AnyImplementedContract> =
  C extends ImplementedContract<infer TInput, infer TOutput, any, infer TOptions, infer TErrors>
    ? CurriedImplementation<z.infer<TInput>, z.infer<TOutput>, TOptions, ErrorUnion<TErrors>>
    : never;

/**
 * Produces the nested object shape for a Namespace in `ServiceWithContracts`:
 * `{ cmd: Omit<ImplementedContract, 'run' | 'withDependencies'> & { run: CurriedImpl } }`
 */
type NamespaceServiceShape<NS extends Record<string, AnyImplementedContract>> = {
  [K in keyof NS]: NS[K] extends AnyImplementedContract ? FlatServiceEntry<NS[K]> : never;
};

/**
 * Produces the nested object shape for a Namespace in `CurriedService`:
 * `{ cmd: CurriedImplementation<...> }`
 */
type NamespaceSimpleShape<NS extends Record<string, AnyImplementedContract>> = {
  [K in keyof NS]: NS[K] extends AnyImplementedContract ? FlatSimpleEntry<NS[K]> : never;
};

/**
 * Type for a service that includes all contract metadata along with curried run functions.
 * 
 * Each command in the service retains its contract metadata (schemas, types, errors)
 * but has its run function curried with dependencies already injected.
 *
 * Namespace entries produce a nested object:
 * `service.users.create.run(input)` instead of `service.users.run(input)`.
 * 
 * @template T - Record of service entries (implemented contracts or namespaces)
 */
export type ServiceWithContracts<T extends Record<string, ServiceEntry>> = {
  [K in keyof T]: T[K] extends Namespace<infer NS>
    ? NamespaceServiceShape<NS & Record<string, AnyImplementedContract>>
    : T[K] extends AnyImplementedContract
      ? FlatServiceEntry<T[K]>
      : never;
};

/**
 * Type for a simplified service that only includes the curried execution functions.
 * 
 * This provides a cleaner API when you only need to execute commands and don't
 * need access to the contract metadata.
 * 
 * Namespace entries produce a nested object:
 * `service.users.create(input)` instead of `service.users(input)`.
 * 
 * @template T - Record of service entries (implemented contracts or namespaces)
 */
export type CurriedService<T extends Record<string, ServiceEntry>> = {
  [K in keyof T]: T[K] extends Namespace<infer NS>
    ? NamespaceSimpleShape<NS & Record<string, AnyImplementedContract>>
    : T[K] extends AnyImplementedContract
      ? FlatSimpleEntry<T[K]>
      : never;
};

// ============================================================================
// SERVICE FACTORY FUNCTIONS
// ============================================================================

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
 * Namespace values produce nested objects:
 * ```typescript
 * const createAppService = serviceFrom({
 *   health: healthContract.implementation(healthImpl),
 *   users: defineNamespace({ create: createUserContract.implementation(createUserImpl) }),
 * });
 * const service = createAppService({ userRepo, ... });
 * service.health.run(input);         // flat
 * service.users.create.run(input);   // namespaced
 * ```
 * 
 * @template T - Record of service entries (implemented contracts or namespaces)
 * 
 * @param commands - Object mapping command names to implemented contracts or namespaces
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
  T extends Record<string, ServiceEntry>
>(
  commands: T
): (deps: MergeDependencies<T>) => ServiceWithContracts<T> {
  return (deps: MergeDependencies<T>) => {
    const service = {} as ServiceWithContracts<T>;
    
    for (const [commandName, entry] of Object.entries(commands)) {
      if (entry && typeof entry === 'object' && NAMESPACE_TAG in entry) {
        // ── Namespace branch: build a nested object for each inner contract ──
        const ns = entry as AnyNamespace;
        const nestedService: Record<string, any> = {};

        for (const [cmdName, innerContract] of Object.entries(ns.contracts)) {
          const ic = innerContract as AnyImplementedContract;
          const curried = ic.withDependencies(deps);
          nestedService[cmdName] = {
            schemas: ic.schemas,
            types: ic.types,
            errors: ic.errors,
            validateInput: ic.validateInput,
            validateOutput: ic.validateOutput,
            run: curried,
          };
        }

        service[commandName as keyof T] = nestedService as any;
      } else {
        // ── Flat contract branch (unchanged from before) ──
        const contract = entry as AnyImplementedContract;
        const curriedCommand = contract.withDependencies(deps);

        service[commandName as keyof T] = {
          schemas: contract.schemas,
          types: contract.types,
          errors: contract.errors,
          validateInput: contract.validateInput,
          validateOutput: contract.validateOutput,
          run: curriedCommand,
        } as any;
      }
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
 * Namespace values produce nested objects:
 * ```typescript
 * const createAppService = serviceFromSimple({
 *   users: defineNamespace({ create: createUserContract.implementation(createUserImpl) }),
 * });
 * const service = createAppService({ userRepo });
 * service.users.create(input);   // no .run, just the curried function
 * ```
 * 
 * @template T - Record of service entries (implemented contracts or namespaces)
 * 
 * @param commands - Object mapping command names to implemented contracts or namespaces
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
  T extends Record<string, ServiceEntry>
>(
  commands: T
): (deps: MergeDependencies<T>) => CurriedService<T> {
  return (deps: MergeDependencies<T>) => {
    const service = {} as CurriedService<T>;
    
    for (const [commandName, entry] of Object.entries(commands)) {
      if (entry && typeof entry === 'object' && NAMESPACE_TAG in entry) {
        // ── Namespace branch: build nested curried functions ──
        const ns = entry as AnyNamespace;
        const nestedService: Record<string, any> = {};

        for (const [cmdName, innerContract] of Object.entries(ns.contracts)) {
          const ic = innerContract as AnyImplementedContract;
          nestedService[cmdName] = ic.withDependencies(deps);
        }

        service[commandName as keyof T] = nestedService as any;
      } else {
        // ── Flat contract branch (unchanged) ──
        const contract = entry as AnyImplementedContract;
        service[commandName as keyof T] = contract.withDependencies(deps) as any;
      }
    }
    
    return service;
  };
}

/**
 * Helper type to extract all dependency types required by a service.
 * 
 * @template T - Record of service entries (implemented contracts or namespaces)
 * 
 * @example
 * ```typescript
 * type UserServiceDeps = ServiceDependencies<typeof userContracts>;
 * // { userRepo: UserRepository, emailService: EmailService }
 * ```
 */
export type ServiceDependencies<T extends Record<string, ServiceEntry>> = MergeDependencies<T>;

/**
 * Helper type to extract all possible error types from a service.
 * 
 * @template T - Record of service entries (implemented contracts or namespaces)
 * 
 * @example
 * ```typescript
 * type UserServiceErrors = ServiceErrors<typeof userContracts>;
 * // UserAlreadyExistsError | UserNotFoundError | ValidationError
 * ```
 */
export type ServiceErrors<T extends Record<string, ServiceEntry>> = MergeErrors<T>;
