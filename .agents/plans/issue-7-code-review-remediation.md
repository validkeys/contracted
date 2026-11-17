# Remediation Plan: `defineNamespace` Code Review Findings

**Branch:** `issue-7`
**Review date:** 2026-11-17
**Source:** post-implementation code review of the `defineNamespace()` PR

Eight findings are grouped into two sequential milestones:

- **Milestone A** — correctness and misleading guarantees (findings 1–4, touch production code)
- **Milestone B** — test hygiene (findings 5–7, touch test code only)

One additional observation (finding 8) is deferred to a follow-up issue.

---

## Global constraints

- `pnpm build` must stay at 0 errors after every task.
- `pnpm test:run src/core/` must stay green after every task.
- Touch **only** the files listed per task.
- Do **not** introduce new npm dependencies.
- Commit after each task with the message prefix listed in the task.

---

## Milestone A — Production-code fixes

### Task A.1 — Remove the hollow `NoNestedNamespaces` conditional

**Finding #1 (Medium): `NoNestedNamespaces<T>` is a no-op type guard**

`NamespaceContractValue` is `Contract | ImplementedContract`. Because `Namespace` is not in that
union, `T[keyof T] extends Namespace<any>` is structurally impossible and the conditional always
resolves to `T`. The compile-time guard never fires.

**Touch ONLY:** `src/core/defineNamespace.ts`

**What to do**

1. Delete the `NoNestedNamespaces<T>` type alias entirely.
2. Simplify `defineNamespace`'s signature to:
   ```ts
   export function defineNamespace<T extends Record<string, NamespaceContractValue>>(
     contracts: T
   ): Namespace<T>
   ```
   (the internal cast `contracts as NoNestedNamespaces<T>` and the `Namespace<NoNestedNamespaces<T>>`
   return type annotation disappear with it).
3. Update the JSDoc on `defineNamespace` and on the `Namespace` interface to remove all claims of
   compile-time enforcement. Replace with an accurate statement:

   > One-level-deep nesting is enforced **at runtime only**. Passing a `Namespace` as a value will
   > throw an `Error` before any other processing occurs. TypeScript cannot statically prevent this
   > because `NamespaceContractValue` excludes `Namespace` from its union; the type constraint alone
   > is sufficient to give a good IDE error when users pass the right types, but it does not catch
   > an explicit `as any` cast.

4. Remove the `@example` block inside the `NoNestedNamespaces` JSDoc comment (it no longer exists).
5. Update the `@template T` JSDoc on `defineNamespace` — remove the sentence _"Any `Namespace` value
   in `T` causes the return type to include `never`"_.

**Validation**
```bash
pnpm build
pnpm test:run src/core/defineNamespace.test.ts
# confirm existing nested-namespace runtime tests still throw
```

**Commit:** `fix: remove hollow NoNestedNamespaces compile-time guard, document runtime-only enforcement`

---

### Task A.2 — Remove dead imports from `defineService.ts`

**Finding #2 (Low): `z`, `TaggedError`, `ErrorUnion`, `CurriedService` imported but never used**

**Touch ONLY:** `src/core/defineService.ts`

**What to do**

Remove these four names from the import lines:

| Import | From |
|--------|------|
| `z` | `'zod'` — remove entire line if `z` was the only import |
| `TaggedError` | `'./errors'` |
| `ErrorUnion` | `'./errors'` |
| `CurriedService` | `'./serviceFrom'` |

After removal the import block should read:

```ts
import { Contract, ImplementedContract } from './defineContract';
import { ValidationError } from './errors';
import { ServiceWithContracts, MergeDependencies, MergeErrors, ServiceEntry } from './serviceFrom';
import { Namespace, NAMESPACE_TAG, NamespaceContractValue } from './defineNamespace';
```

**Validation**
```bash
pnpm build      # must stay 0 errors
pnpm test:run src/core/defineService.test.ts
```

**Commit:** `fix: remove unused imports from defineService`

---

### Task A.3 — Document `ToServiceEntries` fallback behaviour

**Finding #3 (Low): silent degradation when the `extends` check fails**

**Touch ONLY:** `src/core/defineService.ts`

**What to do**

Replace the current sparse comment on `ToServiceEntries` with an expanded block:

```ts
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
type ToServiceEntries<T extends Record<string, ServiceDefinitionEntry>> = ...
```

No logic changes — documentation only.

**Validation**
```bash
pnpm build
```

**Commit:** `docs: expand ToServiceEntries comment to explain fallback behaviour`

---

### Task A.4 — Fix the JSDoc example that passes `.contracts` to `serviceFrom`

**Finding #4 (Low): example in `defineNamespace.ts` calls `serviceFrom({ users: usersNamespace.contracts })` which breaks namespace detection**

Passing `.contracts` strips `NAMESPACE_TAG` from the value. `serviceFrom` would then treat the
inner contracts as unknown flat entries and runtime detection would fail.

**Touch ONLY:** `src/core/defineNamespace.ts`

**What to do**

In the `@example` block of the `defineNamespace` JSDoc (currently lines 163–185), replace:

```ts
const createAppService = serviceFrom({
  users: usersNamespace.contracts,  // or inline
});
```

with:

```ts
// Pass the namespace object itself — do NOT use usersNamespace.contracts
const createAppService = serviceFrom({
  users: usersNamespace,
});
```

Add a note explaining why:

```ts
// Note: pass the Namespace object directly, not usersNamespace.contracts.
// Passing .contracts strips the NAMESPACE_TAG symbol and disables nested routing.
```

**Validation**
```bash
pnpm build
# visual inspection only — no logic change
```

**Commit:** `docs: fix serviceFrom example in defineNamespace JSDoc — pass Namespace not .contracts`

---

## Milestone B — Test hygiene

### Task B.1 — Replace misleading `@ts-expect-error` runtime assertions

**Finding #5 (Low): three tests follow `@ts-expect-error` with `expect(x).toBeDefined()` which is misleading**

The pattern:
```ts
// @ts-expect-error — missing X causes TypeScript error
const result = fn(badArg);
expect(result).toBeDefined();  // ← adds no value; confuses reader
```

The `expect` after a `@ts-expect-error` has no testing value: if the TS error disappears the
test file fails to compile; the runtime assertion is never the signal.

**Touch ONLY:** `src/core/defineNamespace.test.ts`

**What to do**

For each of the three occurrences (lines 674–679, 710–714, 740–744), replace with a type-only
comment pattern and no runtime assertion:

```ts
it('dep injection: missing deps is a TypeScript error (type-only assertion)', () => {
  // @ts-expect-error — TypeScript enforces that all deps are provided.
  // If this line stops being a TS error the test file will fail to compile,
  // which is the intended signal. No runtime assertion needed.
  serviceFrom({ users: usersNamespace })({});
});
```

The variable assignment can be removed entirely (or left as a bare expression) since the value
is never used.

**Validation**
```bash
pnpm build      # @ts-expect-error lines must still be errors (build passes = TS errors present)
pnpm test:run src/core/defineNamespace.test.ts
```

**Commit:** `test: replace misleading @ts-expect-error runtime assertions with type-only comments`

---

### Task B.2 — Move `PostNotFoundError` out of the outer fixture scope

**Finding #6 (Low): `PostNotFoundError` declared at line 21 in the outer `describe` but only used in the integration block at the bottom of the file**

**Touch ONLY:** `src/core/defineNamespace.test.ts`

**What to do**

1. Delete `PostNotFoundError` from the outer fixture block (lines 21–24).
2. It is already re-declared inside `describe('end-to-end integration (issue #7)')`. Confirm it
   exists there and is used. No new code needed — this is a deletion only.

**Validation**
```bash
pnpm build
pnpm test:run src/core/defineNamespace.test.ts
```

**Commit:** `test: remove PostNotFoundError from outer fixture scope (only used in integration block)`

---

### Task B.3 — Remove unused `ok`/`err` import from test file

**Finding #7 (Low): `import { ok, err } from 'neverthrow'` on line 3 — neither is used**

**Touch ONLY:** `src/core/defineNamespace.test.ts`

**What to do**

Delete line 3:
```ts
import { ok, err } from 'neverthrow';
```

**Validation**
```bash
pnpm build
pnpm test:run src/core/defineNamespace.test.ts
```

**Commit:** `test: remove unused ok/err import from defineNamespace.test.ts`

---

## Deferred — Follow-up issue

### Finding #8 (Observation): duplicated namespace-wiring loop across three sites

The `NAMESPACE_TAG in entry` → iterate `ns.contracts` logic appears identically in:

- `serviceFrom` (`src/core/serviceFrom.ts` ~line 282)
- `serviceFromSimple` (`src/core/serviceFrom.ts` ~line 370)
- `defineService.implementation` (`src/core/defineService.ts` ~line 232)

This is not a bug. Extracting a shared helper (e.g. `buildNestedServiceEntry(ns, deps)`) would
reduce drift risk if namespace wiring ever needs to change. This is scoped as a separate refactor
ticket rather than part of this remediation to keep the diff focused.

**Recommended action:** open a follow-up issue titled _"Refactor: extract shared namespace-wiring
helper from serviceFrom / defineService"_ and link it to issue #7.

---

## Execution order

```
A.1 → A.2 → A.3 → A.4 → B.1 → B.2 → B.3
```

Each task is independent after its predecessor commits. Milestone B tasks (B.1–B.3) can be
batched into a single commit if preferred, since they all touch only `defineNamespace.test.ts`.

## Done criteria

- [ ] `pnpm build` exits 0
- [ ] `pnpm test:run src/core/` exits 0 with the same test count (no tests removed, only assertions cleaned up)
- [ ] All 7 task commits present on the branch
- [ ] `NoNestedNamespaces` type no longer exists in the codebase
- [ ] `z`, `TaggedError`, `ErrorUnion`, `CurriedService` no longer appear in `defineService.ts` imports
- [ ] `defineNamespace` JSDoc example uses `serviceFrom({ users: usersNamespace })` not `.contracts`
- [ ] No `@ts-expect-error` block is followed by a runtime `expect(x).toBeDefined()` assertion
- [ ] `PostNotFoundError` does not appear in the outer `describe('defineNamespace')` fixture block
- [ ] `ok`/`err` import removed from `defineNamespace.test.ts`
