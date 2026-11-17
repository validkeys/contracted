import { Contract, ImplementedContract } from './defineContract';
import { ErrorUnion } from './errors';
import { MergeDependencies, MergeErrors } from './serviceFrom';

// ============================================================================
// NAMESPACE TAG
// ============================================================================

/**
 * Branded symbol used to identify Namespace objects at both runtime and type level.
 * Allows TypeScript and runtime code to distinguish a Namespace from a Contract.
 */
export const NAMESPACE_TAG = Symbol('Namespace');

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * A valid contract value inside a namespace — either a plain Contract or an
 * ImplementedContract. Namespace values may NOT be Namespace instances
 * (one-level-deep enforcement).
 */
export type NamespaceContractValue =
  | Contract<any, any, any, any, any>
  | ImplementedContract<any, any, any, any, any>;

/**
 * Conditional guard that evaluates to `never` when any value in `T` is itself
 * a `Namespace`. This enforces the one-level-deep rule at the type level.
 *
 * @example
 * ```typescript
 * // Allowed
 * type Ok = NoNestedNamespaces<{ create: Contract<...> }>; // { create: Contract<...> }
 *
 * // Rejected — evaluates the whole T to never
 * type Bad = NoNestedNamespaces<{ sub: Namespace<any> }>; // never
 * ```
 */
type NoNestedNamespaces<T extends Record<string, NamespaceContractValue>> =
  T[keyof T] extends Namespace<any> ? never : T;

// ============================================================================
// NAMESPACE INTERFACE
// ============================================================================

/**
 * A namespace groups related commands under a single key in a service.
 *
 * Namespaces are **one level deep only** — a `Namespace` value cannot itself
 * contain another `Namespace`. This constraint is enforced both at the type
 * level (the generic resolves to `never` for nested namespaces) and at
 * runtime (a guard throws at the top of `defineNamespace`).
 *
 * @template T - Record mapping command names to `Contract` or `ImplementedContract`
 *   instances. Must not contain any `Namespace` values.
 *
 * @example
 * ```typescript
 * // Standalone — works independently of any service
 * const usersNamespace = defineNamespace({
 *   create: createUserContract,
 *   get:    getUserContract,
 * });
 *
 * usersNamespace.contracts.create;         // createUserContract
 * usersNamespace[NAMESPACE_TAG];           // true
 *
 * // With a service
 * const appService = defineService({
 *   users: usersNamespace,
 *   health: healthContract,
 * });
 * ```
 */
export interface Namespace<
  T extends Record<string, NamespaceContractValue>
> {
  /** Branded tag — present on every Namespace object */
  readonly [NAMESPACE_TAG]: true;

  /**
   * The raw contracts (or implemented contracts) that make up this namespace.
   * Pass these directly to `serviceFrom`, `serviceFromSimple`, or
   * `defineService` / `serviceContract.implementation`.
   */
  contracts: T;

  /**
   * Compile-time type information for the namespace.
   * These properties hold no runtime value — they exist solely for TypeScript inference.
   */
  types: {
    /**
     * The merged intersection of all dependency types required by every command
     * in this namespace.
     */
    Dependencies: T extends Record<string, ImplementedContract<any, any, any, any, any>>
      ? MergeDependencies<T>
      : never;

    /**
     * Union of all possible error types emitted by any command in this namespace.
     */
    Errors: T extends Record<string, ImplementedContract<any, any, any, any, any>>
      ? MergeErrors<T>
      : never;

    /**
     * The original contracts record — same shape as `T`.
     */
    Contracts: T;
  };
}

// ============================================================================
// RUNTIME FUNCTION
// ============================================================================

/**
 * Groups related commands under a single namespace key.
 *
 * A namespace provides a logical grouping of commands that will be accessible
 * as a nested object in the resulting service:
 *
 * ```
 * service.users.create.run(input)   // namespace "users", command "create"
 * service.users.get.run(input)      // namespace "users", command "get"
 * service.health.run(input)         // flat command (no namespace)
 * ```
 *
 * ### One-level-deep enforcement
 *
 * Namespaces may only contain `Contract` / `ImplementedContract` values —
 * **never** another `Namespace`. This is enforced both at compile time (the
 * generic resolves to `never`) and at runtime (an error is thrown before any
 * other processing).
 *
 * ### Standalone metadata
 *
 * The returned `Namespace` object is self-contained and can be used before
 * any service is created:
 *
 * ```typescript
 * const ns = defineNamespace({ create: createUserContract });
 * ns.contracts.create;        // the raw contract
 * NAMESPACE_TAG in ns;        // true
 * ns.types.Dependencies;      // merged deps (type-level only)
 * ns.types.Errors;            // merged errors (type-level only)
 * ```
 *
 * @template T - Record of command names to `Contract` or `ImplementedContract`
 *   values. Any `Namespace` value in `T` causes the return type to include
 *   `never` (compile-time enforcement).
 *
 * @param contracts - Object mapping command names to contracts or implemented contracts.
 *
 * @returns A `Namespace` object tagged with `NAMESPACE_TAG`.
 *
 * @throws {Error} When any value in `contracts` is itself a `Namespace` (runtime guard).
 *
 * @example
 * ```typescript
 * import { defineNamespace, defineCommand } from '@validkeys/contracted';
 * import { z } from 'zod';
 *
 * const createUserContract = defineCommand({
 *   input:        z.object({ name: z.string(), email: z.string().email() }),
 *   output:       z.object({ id: z.string(), name: z.string() }),
 *   dependencies: {} as { userRepo: UserRepository },
 * });
 *
 * // Group into a namespace
 * export const usersNamespace = defineNamespace({
 *   create: createUserContract,
 * });
 *
 * // Use in a service
 * import { serviceFrom } from '@validkeys/contracted';
 *
 * const createAppService = serviceFrom({
 *   users: usersNamespace.contracts,  // or inline
 * });
 * ```
 */
export function defineNamespace<
  T extends Record<string, NamespaceContractValue>
>(contracts: NoNestedNamespaces<T>): Namespace<NoNestedNamespaces<T>> {
  // ──────────────────────────────────────────────────────────────────────────
  // RUNTIME GUARD: one-level-deep enforcement
  // ──────────────────────────────────────────────────────────────────────────
  for (const [key, value] of Object.entries(contracts)) {
    if (value && typeof value === 'object' && NAMESPACE_TAG in value) {
      throw new Error(
        `defineNamespace: nested namespaces are not supported. Key "${key}" is itself a Namespace.`
      );
    }
  }

  const namespace: Namespace<NoNestedNamespaces<T>> = {
    [NAMESPACE_TAG]: true,
    contracts: contracts as NoNestedNamespaces<T>,
    types: {
      Dependencies: {} as any,
      Errors: {} as any,
      Contracts: {} as NoNestedNamespaces<T>,
    },
  };

  return namespace;
}
