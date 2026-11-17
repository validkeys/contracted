# Implementation Plan: `defineNamespace()` — Issue #7

## Overview

Add a `defineNamespace()` export that groups related commands into named sub-scopes within `defineService()` and `serviceFrom()` / `serviceFromSimple()`. Namespaces become nested objects on the resulting service. Dependencies and errors remain merged globally across the service.

## Style Anchors

All tasks must follow these patterns from the existing codebase:

- **`src/core/defineService.ts:51-73`** — `ServiceContract` interface shape (contracts, types, implementation)
- **`src/core/serviceFrom.ts:67-115`** — `MergeDependencies`, `ServiceWithContracts`, `CurriedService` mapped type patterns
- **`src/core/defineService.test.ts:38-64`** — test structure: `describe` → `it` → setup fixtures, assert structure
- **`src/core/defineContract.ts:272-284`** — function signature style with generic constraints

## Constraints

- ONLY use existing dependencies: `zod`, `neverthrow` (already in peerDependencies)
- Namespaces are **one level deep only** — no nested namespaces
- **No breaking changes** to existing flat services
- **No modifications to `defineCommand`** itself
- Touch ONLY the files listed per task
- All tests must pass: `pnpm test:run`
- Zero TypeScript errors: `pnpm build`

## Drift Policy

STOP and report immediately if:
- New npm dependencies introduced
- Files modified beyond the task's `Touch ONLY` list
- TypeScript errors cannot be resolved within task scope
- Tests fail and the model proposes changing existing tests instead of implementation

**Revert:** Run `git stash` or `git checkout -- <files listed in Touch ONLY>` to restore pre-task state. Do not carry partial changes forward.

**Incident note:** Create `docs/drift-incidents/YYYY-MM-DD-<task-id>.md` documenting: what happened, files changed unexpectedly, dependencies proposed, remediation steps. All incident notes must be reviewed by a human maintainer before re-running the task.

---

## Milestone 1: Type Infrastructure

### Task 1.1 — Create `defineNamespace.ts` with types and runtime function

**Estimate:** 90–120 minutes
**Touch ONLY:** `src/core/defineNamespace.ts` (new file)

> **Note:** This task is implementation-only. Do NOT write any test code in this file. All tests for `defineNamespace` live in `src/core/defineNamespace.test.ts` and are written in Task 3.1.

**Style Anchors:**
- `src/core/defineService.ts:51-73` — interface shape with `contracts`, `types`, `implementation`
- `src/core/serviceFrom.ts:46-68` — `ExtractDependencies`, `ExtractErrors` helper types

**Instructions:**

## CRITICAL CONSTRAINTS
- Touch ONLY: `src/core/defineNamespace.ts`
- ONLY use: existing imports from `./defineContract`, `./errors`, `./serviceFrom`
- Must be a branded/tagged interface distinguishable from plain `Contract` at type level
- Do NOT write any test code in this file — tests belong in `src/core/defineNamespace.test.ts`

## Style Anchors
See `src/core/defineService.ts:51-73` for the interface shape pattern.
See `src/core/serviceFrom.ts:46-68` for `ExtractDependencies`/`ExtractErrors` patterns.

## What to Implement

```typescript
// Branded tag so TypeScript can distinguish Namespace from Contract
export const NAMESPACE_TAG = Symbol('Namespace');

export interface Namespace<T extends Record<string, ImplementedContract<any,any,any,any,any> | Contract<any,any,any,any,any>>> {
  readonly [NAMESPACE_TAG]: true;
  contracts: T;
  types: {
    Dependencies: MergeDependencies</* extract only ImplementedContracts from T */>;
    Errors: /* merged errors union */;
    Contracts: T;
  };
}

export function defineNamespace<T extends Record<string, ...>>(contracts: T): Namespace<T>
```

The `Namespace` type must accept both `Contract` (for use in `defineService`) and `ImplementedContract` (for use in `serviceFrom`). Use conditional types or overloads as needed.

## One-Level-Deep Enforcement

Namespaces are **one level deep only**. Enforce this at both the type level and at runtime:

- **Type-level:** The generic bound on `T` must exclude `Namespace` values. Use a conditional type that produces `never` if any value in `T` extends `Namespace<any>`. Example: `T extends Record<string, Namespace<any>> ? never : T` or a mapped-type constraint.
- **Runtime guard:** At the start of `defineNamespace`, iterate `contracts` and throw if any value contains `NAMESPACE_TAG`:
  ```typescript
  for (const [key, value] of Object.entries(contracts)) {
    if (value && typeof value === 'object' && NAMESPACE_TAG in value) {
      throw new Error(
        `defineNamespace: nested namespaces are not supported. ` +
        `Key "${key}" is itself a Namespace.`
      );
    }
  }
  ```

## Standalone Metadata

The returned `Namespace` object must expose its metadata independently of any service. Callers must be able to do:

```typescript
const usersNamespace = defineNamespace({ create: createUserContract });
usersNamespace.contracts          // { create: createUserContract }
usersNamespace.types.Dependencies // merged deps of all commands
usersNamespace.types.Errors       // merged errors of all commands
usersNamespace.types.Contracts    // { create: createUserContract }
```

## Validation
```
pnpm build
pnpm test:run
```

**Expected output:** 0 TypeScript errors, all existing tests passing.
**Failure handling:** STOP. Revert with `git checkout -- src/core/defineNamespace.ts`. Do not modify existing tests.

---

### Task 1.2 — Extend `MergeDependencies` and `ServiceWithContracts` for namespaces

**Estimate:** 90–120 minutes
**Touch ONLY:** `src/core/serviceFrom.ts`

**Style Anchors:**
- `src/core/serviceFrom.ts:67-115` — the existing `MergeDependencies`, `ServiceWithContracts`, `CurriedService` types

**TDD Checklist:**
- [ ] Write failing type test: `MergeDependencies` with a mix of flat commands and namespaces produces the correct intersection
- [ ] Write failing type test: `ServiceWithContracts` with a namespace entry produces `{ users: { create: { run: ..., schemas: ... } } }`
- [ ] Update `MergeDependencies` to handle namespace values (extract deps from their contained contracts)
- [ ] Update `ServiceWithContracts` to handle namespace values (map to nested object)
- [ ] Update `CurriedService` to handle namespace values

**Instructions:**

## CRITICAL CONSTRAINTS
- Touch ONLY: `src/core/serviceFrom.ts`
- ONLY use: `Namespace`, `NAMESPACE_TAG` from `./defineNamespace`
- Do NOT break existing flat-service behavior

## Style Anchors
See `src/core/serviceFrom.ts:46-115` for the patterns you are extending.

## What to Change

The union discriminant is the `NAMESPACE_TAG` symbol. Each mapped type needs a conditional branch:

```typescript
// MergeDependencies: include deps from namespace's contained contracts
// ServiceWithContracts: for a Namespace<T> value, produce { [K2 in keyof T]: ... }
// CurriedService: same nesting for simplified services
```

Use helper types like `ExtractNamespaceContracts<T>` to keep branches clean.

## Validation
```
pnpm build
pnpm test:run
```

**Expected output:** 0 TypeScript errors, all existing tests passing.
**Failure handling:** STOP. Revert with `git checkout -- src/core/serviceFrom.ts`. Do not proceed to Task 2.1.

---

## Milestone 2: Runtime Wiring

### Task 2.1 — Update `serviceFrom` and `serviceFromSimple` to handle namespaces

**Estimate:** 60–90 minutes
**Touch ONLY:** `src/core/serviceFrom.ts`

**Style Anchors:**
- `src/core/serviceFrom.ts:162-187` — the `serviceFrom` runtime loop
- `src/core/serviceFrom.ts:220-234` — the `serviceFromSimple` runtime loop

**TDD Checklist:**
- [ ] Write failing test: `serviceFrom` with a namespace entry produces a nested service object at runtime
- [ ] Write failing test: `service.users.create.run(...)` resolves correctly
- [ ] Write failing test: `service.users.create.schemas.input` is accessible
- [ ] Write failing test: `serviceFrom` with one flat command and one namespace — both `flatCmd.run(...)` and `ns.create.run(...)` succeed in the same service instance
- [ ] Implement the namespace branch in `serviceFrom`'s loop
- [ ] Implement the namespace branch in `serviceFromSimple`'s loop

**Instructions:**

## CRITICAL CONSTRAINTS
- Touch ONLY: `src/core/serviceFrom.ts`
- Do NOT break existing flat-service behavior
- Use the `NAMESPACE_TAG` symbol to detect namespace entries at runtime

## Style Anchors
See `src/core/serviceFrom.ts:170-183` for the per-command loop you are extending.

## What to Add

```typescript
for (const [key, value] of Object.entries(commands)) {
  if (NAMESPACE_TAG in value) {
    // Build nested object: iterate value.contracts, same as flat loop
    service[key] = /* nested object of curried commands */;
  } else {
    // existing flat path
  }
}
```

## Validation
```
pnpm test:run src/core/serviceFrom
pnpm build
```

**Expected output:** All serviceFrom tests passing, 0 TypeScript errors.
**Failure handling:** STOP. Revert with `git checkout -- src/core/serviceFrom.ts`. Do not proceed to Task 2.2.

---

### Task 2.2 — Update `defineService` to handle namespaces at contract and implementation level

**Estimate:** 60–90 minutes
**Touch ONLY:** `src/core/defineService.ts`

**Style Anchors:**
- `src/core/defineService.ts:25-73` — `ImplementedContractsFrom`, `ServiceContract` interface
- `src/core/defineService.ts:136-164` — `implementation` factory loop

**TDD Checklist:**
- [ ] Write failing test: `defineService({ users: defineNamespace({ create: createUserContract }) })` creates valid contract
- [ ] Write failing test: `.implementation({ users: defineNamespace({ create: createUserImpl }) })` wires correctly
- [ ] Write failing test: `service.users.create.run(...)` resolves from `defineService` path
- [ ] Update `ImplementedContractsFrom` to pass through namespace values
- [ ] Update `ServiceContract.types.Dependencies` to include namespace deps
- [ ] Update `implementation` loop to detect and handle namespaces

**Instructions:**

## CRITICAL CONSTRAINTS
- Touch ONLY: `src/core/defineService.ts`
- Do NOT break existing flat-service behavior
- Use `NAMESPACE_TAG` from `./defineNamespace` to detect namespaces

## Style Anchors
See `src/core/defineService.ts:136-164` for the loop you are extending.
See `src/core/defineService.ts:25-29` for the `ImplementedContractsFrom` mapped type.

## What to Change

`ImplementedContractsFrom` must pass namespace values through unchanged (they already contain `ImplementedContract` values). The `implementation` loop needs the same namespace-detection branch as `serviceFrom`.

The missing-implementation guard (`throw new Error('Missing implementation for contract: ...')`) should check namespace keys against their contained command keys, not just top-level keys.

## Validation
```
pnpm test:run src/core/defineService
pnpm build
```

**Expected output:** All defineService tests passing, 0 TypeScript errors.
**Failure handling:** STOP. Revert with `git checkout -- src/core/defineService.ts`. Do not proceed to Milestone 3.

---

## Milestone 3: Tests, Export, and Polish

### Task 3.1 — Write comprehensive namespace tests, export, and JSDoc

**Estimate:** 105–150 minutes
**Touch ONLY:** `src/core/defineNamespace.test.ts` (new file), `src/core/defineNamespace.ts` (JSDoc additions only), `src/index.ts`

**Style Anchors:**
- `src/core/defineService.test.ts:1-64` — test file structure, fixture setup
- `src/core/defineService.test.ts:66-178` — runtime behavior tests
- `src/core/defineService.test.ts:325-366` — type safety tests with `expectTypeOf`
- `src/core/defineService.ts:40-122` — JSDoc style for interface and function

**TDD Checklist (write ALL tests before running):**
- [ ] Standalone metadata: `const ns = defineNamespace({...}); expect(ns.contracts).toBeDefined()` — verifies standalone usage outside of any service context
- [ ] Standalone type test: `expectTypeOf<typeof ns.types.Dependencies>().toEqualTypeOf<{ userRepo: UserRepo }>()` — `usersNamespace.types.Dependencies` is correctly typed
- [ ] Standalone type test: `usersNamespace.types.Errors` is the merged errors union of all contained commands
- [ ] `defineNamespace` returns object with `contracts`, `types`, and `NAMESPACE_TAG` properties
- [ ] `serviceFrom` with namespaces: nested command is callable via `service.ns.cmd.run(...)`
- [ ] `serviceFrom` with namespaces: nested command exposes `.schemas`, `.errors`, `.validateInput`, `.validateOutput`
- [ ] `serviceFrom` with mixed flat + namespaced: `flatCmd.run(...)` and `ns.create.run(...)` both succeed in the same service instance
- [ ] `serviceFromSimple` with namespaces: `service.ns.cmd(input)` resolves
- [ ] `defineService` → `.implementation()` with namespaces: `service.ns.cmd.run(...)` resolves
- [ ] Dependencies merge: a service with namespaces requires ALL deps from ALL commands at init
- [ ] Errors merge: errors from namespaced commands appear in the service error union
- [ ] Type test: `service.users.create.run` is fully typed, no `any`
- [ ] Type test: `MergeDependencies` with namespaces equals intersection of all deps
- [ ] Namespace cannot contain another namespace — runtime throws `'defineNamespace: nested namespaces are not supported'`
- [ ] Existing flat service tests still pass (run full suite with `pnpm test:run` and confirm zero regressions)

**After all tests are green:**
- [ ] Add `export * from './core/defineNamespace'` to `src/index.ts` (keep alphabetical order)
- [ ] Confirm `defineNamespace` and `Namespace` are accessible from the package root via `pnpm build`
- [ ] Add JSDoc to `defineNamespace` function following `src/core/defineService.ts:76-122` style
- [ ] Add JSDoc to `Namespace` interface following `src/core/defineService.ts:40-73` style

**Instructions:**

## CRITICAL CONSTRAINTS
- Touch ONLY: `src/core/defineNamespace.test.ts`, `src/core/defineNamespace.ts` (JSDoc only), `src/index.ts`
- Do NOT modify any existing test file
- Use `expectTypeOf` for type assertions
- Write ALL tests first, then confirm they pass, then add JSDoc and export

## Style Anchors
See `src/core/defineService.test.ts:1-10` for import pattern.
See `src/core/defineService.test.ts:325-366` for `expectTypeOf` type assertions.
See `src/core/defineService.ts:40-122` for JSDoc style.

## Validation
```
pnpm test:run src/core/defineNamespace
pnpm build
pnpm test:run
```

**Expected output:** All new tests passing, 0 TypeScript errors, `dist/` exposes `defineNamespace`.
**Failure handling:** STOP. Fix implementation in prior tasks. Do not modify tests. Revert with `git stash`.

---

### Task 3.2 — Final integration smoke test

**Estimate:** 30–45 minutes
**Touch ONLY:** `src/core/defineNamespace.test.ts` (append only)

**TDD Checklist:**
- [ ] Add an end-to-end test using the full API as described in issue #7:
  - `defineService` with `users` and `posts` namespaces
  - `serviceFrom` with mixed flat + namespace (one top-level command plus one namespace)
  - `serviceFromSimple` with namespaces
  - Verify `service.users.create.run(...)` and `service.posts.publish.run(...)` both succeed
  - Verify `service.users.create.schemas.input` is accessible
  - Verify dep injection requires all deps from all commands (flat and namespaced)
  - Verify `serviceFrom` mixed path: `service.flatCmd.run(...)` and `service.ns.create.run(...)` both succeed in the same instance

**Instructions:**

## CRITICAL CONSTRAINTS
- Touch ONLY: `src/core/defineNamespace.test.ts` (append only)
- Use the exact API shapes from issue #7

## Validation
```
pnpm test:run
pnpm build
```

**Expected output:** All tests passing, 0 TypeScript errors, clean build.
**Failure handling:** STOP. File `docs/drift-incidents/YYYY-MM-DD-task-3-2.md` with the failing assertion and regression trace.

---

## Summary of Files Changed

| File | Status | Task |
|------|--------|------|
| `src/core/defineNamespace.ts` | **New** | 1.1, 3.1 |
| `src/core/defineNamespace.test.ts` | **New** | 3.1, 3.2 |
| `src/core/serviceFrom.ts` | Modified | 1.2, 2.1 |
| `src/core/defineService.ts` | Modified | 2.2 |
| `src/index.ts` | Modified | 3.1 |

## Quality Gates

Before marking any task complete:

```bash
pnpm build           # 0 TypeScript errors
pnpm test:run        # All tests pass
git add <touch-only files> && git commit -m "feat: <task name>"
```

No task is complete if either `pnpm build` or `pnpm test:run` reports errors, even outside the task's direct scope. Commit after each task to maintain a clean, revertable history.
