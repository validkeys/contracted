import { Contract, ImplementedContract } from './defineContract';
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

// ============================================================================
// NAMESPACE INTERFACE
// ============================================================================

/**
 * A namespace groups related commands under a single key in a service.
 *
 * Namespaces are **one level deep only** — a `Namespace` value cannot itself
 * contain another `Namespace`. This constraint is enforced **at runtime only**:
 * passing a `Namespace` as a value will throw an `Error` before any other
 * processing occurs. TypeScript cannot statically prevent this because
 * `NamespaceContractValue` excludes `Namespace` from its union; the type
 * constraint alone gives a good IDE error when users pass the right types, but
 * it does not catch an explicit `as any` cast.
 *
 * ### Variance note
 *
 * `types` is intentionally **not** part of this structural interface. The
 * `MergeDependencies<T>` conditional type inside `types` uses T in a
 * contravariant position (via `UnionToIntersection`), which makes the whole
 * interface invariant in T. That breaks assignment of concrete
 * `Namespace<{ create: Contract<...> }>` values to
 * `Namespace<Record<string, NamespaceContractValue>>` in stricter compilers
 * (tsgo / TypeScript 7+). By keeping `types` only on the concrete return type
 * of `defineNamespace`, assignability is restored: `contracts` is `readonly`
 * (covariant), and `[NAMESPACE_TAG]` is brand-only. The compile-time
 * `typeof ns.types.Dependencies` pattern still works via the inferred return
 * type of `defineNamespace`.
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
export interface Namespace<T extends Record<string, NamespaceContractValue>> {
  /** Branded tag — present on every Namespace object */
  readonly [NAMESPACE_TAG]: true;

  /**
   * The raw contracts (or implemented contracts) that make up this namespace.
   * Pass these directly to `serviceFrom`, `serviceFromSimple`, or
   * `defineService` / `serviceContract.implementation`.
   *
   * `readonly` makes `Namespace<T>` covariant in `T`, so a narrowly-typed
   * `Namespace<{ create: Contract<...> }>` is structurally assignable to
   * `Namespace<Record<string, NamespaceContractValue>>`.
   */
  readonly contracts: T;
}

// ============================================================================
// CONCRETE RETURN TYPE (includes compile-time metadata)
// ============================================================================

/**
 * The concrete type returned by `defineNamespace`. Extends `Namespace<T>` with
 * compile-time metadata in `types`.
 *
 * ### Why this is separate from `Namespace<T>`
 *
 * `types.Dependencies` and `types.Errors` use `MergeDependencies<T>` /
 * `MergeErrors<T>`, which place `T` in a contravariant position (the
 * `UnionToIntersection` helper uses a function parameter). That makes any
 * interface that declares those members invariant in `T`, which prevents
 * assigning `Namespace<{ create: X }>` to `Namespace<Record<string, X>>`
 * in stricter compilers (tsgo / TypeScript 7+).
 *
 * Keeping these members only on `ConcreteNamespace` (the inferred return type
 * of `defineNamespace`) means users can still write:
 *
 * ```typescript
 * type Deps = typeof myNamespace.types.Dependencies;
 * ```
 *
 * …while `Namespace<T>` itself remains covariant and assignable to the
 * `ServiceDefinitionEntry` union without a cast.
 */
export interface ConcreteNamespace<T extends Record<string, NamespaceContractValue>>
  extends Namespace<T> {
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
 * **never** another `Namespace`. This is enforced **at runtime**: an error is
 * thrown before any other processing when a nested `Namespace` is detected.
 * There is no compile-time guard — TypeScript's structural type system cannot
 * distinguish a `Namespace` from other objects when `as any` casts are used.
 *
 * ### Compile-time metadata
 *
 * The returned object is typed as `ConcreteNamespace<T>`, which extends
 * `Namespace<T>` and adds a `types` property for inference:
 *
 * ```typescript
 * const ns = defineNamespace({ create: createUserContract });
 * ns.contracts.create;        // the raw contract
 * NAMESPACE_TAG in ns;        // true
 * type Deps = typeof ns.types.Dependencies;  // merged deps (type-level only)
 * type Errs = typeof ns.types.Errors;        // merged errors (type-level only)
 * ```
 *
 * @template T - Record of command names to `Contract` or `ImplementedContract`
 *   values. `Namespace` values in `T` are rejected at runtime by the guard
 *   inside `defineNamespace`.
 *
 * @param contracts - Object mapping command names to contracts or implemented contracts.
 *
 * @returns A `ConcreteNamespace` tagged with `NAMESPACE_TAG`.
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
 * // Use in a service — pass the Namespace object directly, NOT usersNamespace.contracts.
 * // Passing .contracts strips NAMESPACE_TAG and disables nested routing.
 * import { serviceFrom } from '@validkeys/contracted';
 *
 * const createAppService = serviceFrom({
 *   users: usersNamespace,
 * });
 * ```
 */
export function defineNamespace<
  T extends Record<string, NamespaceContractValue>
>(contracts: T): ConcreteNamespace<T> {
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

  const namespace: ConcreteNamespace<T> = {
    [NAMESPACE_TAG]: true,
    contracts,
    types: {
      Dependencies: {} as any,
      Errors: {} as any,
      Contracts: {} as T,
    },
  };

  return namespace;
}
