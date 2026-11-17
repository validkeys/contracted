import { Contract, ImplementedContract } from './defineContract';
import { ValidationError } from './errors';
import { ServiceWithContracts, MergeDependencies, MergeErrors, ServiceEntry } from './serviceFrom';
import { Namespace, NAMESPACE_TAG } from './defineNamespace';

// ============================================================================
// HELPER ALIASES
// ============================================================================

type AnyContract = Contract<any, any, any, any, any>;
type AnyImplementedContract = ImplementedContract<any, any, any, any, any>;
type AnyNamespace = Namespace<Record<string, AnyImplementedContract>>;

// ============================================================================
// ENTRY TYPE — what defineService() accepts
// ============================================================================

/**
 * A single entry in a service definition — either a Contract or a Namespace of Contracts.
 *
 * `Namespace<any>` is intentionally used here rather than
 * `Namespace<Record<string, NamespaceContractValue>>`. Both are structurally
 * equivalent, but `Namespace<any>` avoids a TypeScript variance failure that
 * surfaces in stricter compilers (tsgo / TypeScript 7+): checking
 * `Namespace<{ create: X }> extends Namespace<Record<string, Y>>` requires
 * checking `{ create: X } extends Record<string, Y>`, which TypeScript refuses
 * when `X` and `Y` involve complex conditional types (like
 * `MergeDependencies<T>`). `Namespace<any>` bypasses the check entirely.
 *
 * The fix that makes this safe is in `Namespace<T>` itself: the `types` block
 * (which causes the invariance) is no longer part of the structural interface —
 * it lives only on `ConcreteNamespace<T>`. See defineNamespace.ts for details.
 */
export type ServiceDefinitionEntry =
  | AnyContract
  | Namespace<any>;

// ============================================================================
// IMPLEMENTED CONTRACTS FROM
// ============================================================================

/**
 * Helper type that converts a record of Contracts (and Namespaces of Contracts) to
 * ImplementedContracts (and Namespaces of ImplementedContracts).
 *
 * Since the `.implementation()` method automatically adds `ValidationError` to the
 * error union for input/output validation, this type includes `ValidationError` in
 * the error union to match the actual runtime behaviour.
 *
 * @template T - Record of service definition entries
 *
 * @example
 * ```typescript
 * type Implementations = ImplementedContractsFrom<{
 *   createUser: Contract<...>,
 *   users: Namespace<{ get: Contract<...> }>
 * }>;
 * // {
 * //   createUser: ImplementedContract<..., [...errors, ValidationError]>,
 * //   users: Namespace<{ get: ImplementedContract<..., [...errors, ValidationError]> }>
 * // }
 * ```
 */
export type ImplementedContractsFrom<T extends Record<string, ServiceDefinitionEntry>> = {
  [K in keyof T]: T[K] extends Namespace<infer NS>
    ? Namespace<{
        [K2 in keyof NS]: NS[K2] extends Contract<infer TInput, infer TOutput, infer TDeps, infer TOptions, infer TErrors>
          ? ImplementedContract<TInput, TOutput, TDeps, TOptions, [...TErrors, typeof ValidationError]>
          : NS[K2] extends ImplementedContract<any, any, any, any, any>
            ? NS[K2]
            : never;
      }>
    : T[K] extends Contract<infer TInput, infer TOutput, infer TDeps, infer TOptions, infer TErrors>
      ? ImplementedContract<TInput, TOutput, TDeps, TOptions, [...TErrors, typeof ValidationError]>
      : never;
};

// ============================================================================
// CONCRETE TYPES FOR SERVICE CONTRACT
// ============================================================================

/**
 * Widens `ImplementedContractsFrom<T>` to `Record<string, ServiceEntry>` so it
 * can be passed to `MergeDependencies`, `MergeErrors`, and `ServiceWithContracts`.
 *
 * ### Why this exists
 * TypeScript cannot statically prove that the mapped conditional type
 * `ImplementedContractsFrom<T>` satisfies `Record<string, ServiceEntry>` because
 * it involves a two-level conditional (Namespace branch + flat branch) whose
 * combined result is too complex for the type checker to verify structurally.
 *
 * ### Fallback behaviour
 * The `extends` check here **always passes** for well-formed `T` (i.e. any `T`
 * that only contains `Contract` or `Namespace<Record<string, Contract>>` values).
 * The `Record<string, ServiceEntry>` fallback branch is a safety net for inputs
 * that TypeScript considers degenerate (e.g. `T = Record<string, never>`).
 * When the fallback fires, `ServiceContract.types.Service`, `.Dependencies`, and
 * `.Errors` lose their precise types and become wide. This is acceptable because:
 * 1. The runtime behaviour is unaffected.
 * 2. It only occurs for inputs that cannot produce a meaningful service anyway.
 */
type ToServiceEntries<T extends Record<string, ServiceDefinitionEntry>> =
  ImplementedContractsFrom<T> extends Record<string, ServiceEntry>
    ? ImplementedContractsFrom<T>
    : Record<string, ServiceEntry>;

// ============================================================================
// SERVICE CONTRACT INTERFACE
// ============================================================================

/**
 * Interface representing a service contract definition without implementations.
 * 
 * A service contract defines the collection of commands that make up a service
 * and provides type information that can be used before implementations exist.
 * This enables clean separation between contract definition and implementation.
 * 
 * @template T - Record of service definition entries (Contracts or Namespaces of Contracts)
 * 
 * @example
 * ```typescript
 * const userServiceContract: ServiceContract<{
 *   createUser: Contract<...>,
 *   users: Namespace<{ get: Contract<...> }>
 * }> = defineService({
 *   createUser: createUserContract,
 *   users: defineNamespace({ get: getUserContract })
 * });
 * ```
 */
export interface ServiceContract<
  T extends Record<string, ServiceDefinitionEntry>
> {
  /** The individual contracts that make up this service */
  contracts: T;
  
  /** Type information available at compile time */
  types: {
    /** The type of the runtime service instance */
    Service: ServiceWithContracts<ToServiceEntries<T>>;
    /** The merged dependencies required by all commands (including those in namespaces) */
    Dependencies: MergeDependencies<ToServiceEntries<T>>;
    /** Union of all possible errors from all commands (including those in namespaces) */
    Errors: MergeErrors<ToServiceEntries<T>>;
    /** The original contracts for reference */
    Contracts: T;
  };
  
  /** Method to create a service factory from implementations */
  implementation: (
    implementations: ImplementedContractsFrom<T>
  ) => (deps: MergeDependencies<ToServiceEntries<T>>) => ServiceWithContracts<ToServiceEntries<T>>;
}

// ============================================================================
// RUNTIME FUNCTION
// ============================================================================

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
 * @template T - Record of service definition entries (Contracts or Namespaces of Contracts)
 * 
 * @param contracts - Object mapping command names to contract definitions or namespaces
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
  T extends Record<string, ServiceDefinitionEntry>
>(
  contracts: T
): ServiceContract<T> {
  const serviceContract: ServiceContract<T> = {
    contracts,
    types: {
      Service: {} as ServiceWithContracts<ToServiceEntries<T>>,
      Dependencies: {} as MergeDependencies<ToServiceEntries<T>>,
      Errors: {} as MergeErrors<ToServiceEntries<T>>,
      Contracts: {} as T,
    },
    implementation: (implementations: ImplementedContractsFrom<T>) => {
      // ────────────────────────────────────────────────────────────────────────
      // VALIDATION: ensure every required contract has an implementation
      // ────────────────────────────────────────────────────────────────────────
      for (const contractName in contracts) {
        if (!(contractName in implementations)) {
          throw new Error(`Missing implementation for contract: ${contractName}`);
        }

        const contractEntry = contracts[contractName];
        // For namespace entries, verify every sub-command is implemented
        if (contractEntry && typeof contractEntry === 'object' && NAMESPACE_TAG in contractEntry) {
          const nsContract = contractEntry as Namespace<Record<string, AnyContract>>;
          const nsImpl = (implementations as any)[contractName];

          if (!nsImpl || typeof nsImpl !== 'object' || !(NAMESPACE_TAG in nsImpl)) {
            throw new Error(
              `Missing namespace implementation for contract: ${contractName}. ` +
              `Expected a Namespace object wrapping implementations.`
            );
          }

          const nsImplContracts = (nsImpl as AnyNamespace).contracts;
          for (const subCmd in nsContract.contracts) {
            if (!(subCmd in nsImplContracts)) {
              throw new Error(
                `Missing implementation for contract: ${contractName}.${subCmd}`
              );
            }
          }
        }
      }

      // ────────────────────────────────────────────────────────────────────────
      // FACTORY: return a function that accepts deps and builds the service
      // ────────────────────────────────────────────────────────────────────────
      return (deps: MergeDependencies<ToServiceEntries<T>>) => {
        const service = {} as ServiceWithContracts<ToServiceEntries<T>>;
        
        for (const [commandName, implEntry] of Object.entries(implementations)) {
          if (implEntry && typeof implEntry === 'object' && NAMESPACE_TAG in implEntry) {
            // ── Namespace branch: build a nested service object ──────────────
            const ns = implEntry as AnyNamespace;
            const nestedService: Record<string, any> = {};

            for (const [cmdName, innerContract] of Object.entries(ns.contracts)) {
              const ic = innerContract as AnyImplementedContract;
              const curriedCommand = ic.withDependencies(deps as any);
              nestedService[cmdName] = {
                schemas: ic.schemas,
                types: ic.types,
                errors: ic.errors,
                validateInput: ic.validateInput,
                validateOutput: ic.validateOutput,
                run: curriedCommand,
              };
            }

            service[commandName as keyof ServiceWithContracts<ToServiceEntries<T>>] = nestedService as any;
          } else {
            // ── Flat contract branch (unchanged from before) ─────────────────
            const implementation = implEntry as AnyImplementedContract;
            const curriedCommand = implementation.withDependencies(deps as any);

            service[commandName as keyof ServiceWithContracts<ToServiceEntries<T>>] = {
              schemas: implementation.schemas,
              types: implementation.types,
              errors: implementation.errors,
              validateInput: implementation.validateInput,
              validateOutput: implementation.validateOutput,
              run: curriedCommand,
            } as any;
          }
        }
        
        return service;
      };
    },
  };

  return serviceContract;
}
