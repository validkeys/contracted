# Continuation Prompt: Implement `defineNamespace()` — Issue #7

## Your Mission

Implement the `defineNamespace()` feature for the `@validkeys/contracted` TypeScript library,
following the plan in `.agents/plans/issue-7-define-namespace.md` task by task. Work in the
repository at `/Users/kydavis/Sites/contracted`.

Execute tasks **sequentially** in order: 1.1 → 1.2 → 2.1 → 2.2 → 3.1 → 3.2. Mark each task
complete before starting the next. Do NOT parallelize tasks — each depends on the previous.

---

## Repository Context

**Working directory:** `/Users/kydavis/Sites/contracted`
**Package:** `@validkeys/contracted` — TypeScript library, no framework
**Test runner:** `pnpm test:run` (Vitest)
**Type check / build:** `pnpm build` (tsc, strict mode)
**Node modules:** already installed

### Key source files (read these before starting)

| File | Why it matters |
|------|----------------|
| `src/core/defineContract.ts` | `Contract`, `ImplementedContract` interfaces — the base types you will reference |
| `src/core/serviceFrom.ts` | `MergeDependencies`, `ServiceWithContracts`, `CurriedService`, `serviceFrom`, `serviceFromSimple` — you will extend all five |
| `src/core/defineService.ts` | `ImplementedContractsFrom`, `ServiceContract`, `defineService` — you will extend these |
| `src/index.ts` | Root barrel export — add `defineNamespace` here in Task 3.1 |
| `src/core/defineService.test.ts` | Style anchor for test structure and `expectTypeOf` patterns |

### Style anchors (read the exact line ranges before coding)

- `src/core/defineService.ts:51-73` — `ServiceContract` interface shape
- `src/core/serviceFrom.ts:67-115` — `MergeDependencies`, `ServiceWithContracts`, `CurriedService`
- `src/core/serviceFrom.ts:162-187` — `serviceFrom` runtime loop
- `src/core/serviceFrom.ts:220-234` — `serviceFromSimple` runtime loop
- `src/core/defineService.ts:136-164` — `implementation` factory loop
- `src/core/defineService.ts:40-122` — JSDoc style
- `src/core/defineService.test.ts:1-64` — test file structure and fixture setup
- `src/core/defineService.test.ts:325-366` — `expectTypeOf` type assertions

---

## Global Constraints (apply to every task)

- **ONLY use** existing dependencies: `zod`, `neverthrow` (already in `peerDependencies`). Introducing any new npm dependency is a drift trigger — STOP immediately.
- **Touch ONLY** the files listed in each task. Modifying any other file is a drift trigger — STOP immediately.
- **No breaking changes** to existing flat services.
- **No modifications** to `defineCommand` or any existing test file.
- Namespaces are **one level deep only** — no nested namespaces.

## Drift Policy

**STOP and report immediately if:**
- New npm dependencies introduced
- Files modified beyond the task's `Touch ONLY` list
- TypeScript errors cannot be resolved within task scope
- Tests fail and you are tempted to change existing tests instead of fixing the implementation

**Revert:** `git stash` or `git checkout -- <files in Touch ONLY>`

**Incident note:** Create `docs/drift-incidents/YYYY-MM-DD-<task-id>.md` and stop work.

---

## Task Execution Protocol

For each task:

1. Read the relevant style anchor lines before writing any code.
2. Run `pnpm test:run` and `pnpm build` first to confirm the baseline is green.
3. Follow the TDD checklist in order — write the test/type assertion first, then implement.
4. After passing, run the full validation commands listed in the task.
5. Commit: `git add <touch-only files> && git commit -m "feat: <task name>"`
6. Only then move to the next task.

---

## Task 1.1 — Create `src/core/defineNamespace.ts`

**Touch ONLY:** `src/core/defineNamespace.ts` (new file — implementation only, no test code)
**Estimate:** 90–120 min

This task is **implementation-only**. Do NOT write any test code in this file.
Tests live in `src/core/defineNamespace.test.ts` and are written in Task 3.1.

### What to implement

```typescript
// Branded tag so TypeScript can distinguish Namespace from Contract at runtime and type level
export const NAMESPACE_TAG = Symbol('Namespace');

export interface Namespace<T extends Record<string, ...>> {
  readonly [NAMESPACE_TAG]: true;
  contracts: T;
  types: {
    Dependencies: /* merged deps of all commands in T */;
    Errors:       /* merged errors union of all commands in T */;
    Contracts: T;
  };
}

export function defineNamespace<T extends Record<string, ...>>(contracts: T): Namespace<T>
```

The generic bound on `T` must exclude `Namespace` values (type-level one-deep enforcement).

### One-level-deep enforcement (BOTH required)

**Type-level:** Use a conditional type or mapped-type constraint that makes `T` resolve to
`never` if any value extends `Namespace<any>`. This prevents nesting at compile time.

**Runtime guard** (place at the top of `defineNamespace` before any other logic):
```typescript
for (const [key, value] of Object.entries(contracts)) {
  if (value && typeof value === 'object' && NAMESPACE_TAG in value) {
    throw new Error(
      `defineNamespace: nested namespaces are not supported. Key "${key}" is itself a Namespace.`
    );
  }
}
```

### Standalone metadata

The returned object must work independently of any service:
```typescript
const ns = defineNamespace({ create: createUserContract });
ns.contracts          // { create: createUserContract }
ns.types.Dependencies // merged deps type
ns.types.Errors       // merged errors type
ns.types.Contracts    // { create: createUserContract }
```

The `Namespace` type must accept both `Contract` and `ImplementedContract` values in `T` so
it works in both `defineService()` (contracts layer) and `serviceFrom()` (implementation layer).

### Imports available
```typescript
import { Contract, ImplementedContract } from './defineContract';
import { ErrorUnion, TaggedError } from './errors';
import { MergeDependencies, MergeErrors } from './serviceFrom';
```

### Validation
```bash
pnpm build      # 0 errors
pnpm test:run   # all existing tests still pass
git add src/core/defineNamespace.ts && git commit -m "feat: add defineNamespace type and runtime function"
```

---

## Task 1.2 — Extend type utilities in `src/core/serviceFrom.ts`

**Touch ONLY:** `src/core/serviceFrom.ts`
**Estimate:** 90–120 min

Extend `MergeDependencies`, `ServiceWithContracts`, and `CurriedService` to handle
`Namespace` values alongside flat `ImplementedContract` values.

### TDD checklist (write type tests in a temporary scratch or inline — these will be validated by `pnpm build`)

- [ ] `MergeDependencies` with a mix of flat commands and a namespace produces the correct intersection
- [ ] `ServiceWithContracts` with a namespace entry produces `{ users: { create: { run: ..., schemas: ... } } }`
- [ ] `CurriedService` with a namespace entry produces `{ users: { create: CurriedImplementation<...> } }`

### What to change

Import `Namespace` and `NAMESPACE_TAG` from `./defineNamespace`.

Each mapped type needs a conditional branch on whether a value is `Namespace<any>`:

```typescript
// Sketch — adapt to match the existing patterns in serviceFrom.ts:67-115
type MergeDependencies<T> = UnionToIntersection<
  {
    [K in keyof T]: T[K] extends Namespace<infer NS>
      ? ExtractDependencies<NS[keyof NS]>   // deps from namespace's inner contracts
      : ExtractDependencies<T[K]>           // deps from flat contract
  }[keyof T]
>;

type ServiceWithContracts<T> = {
  [K in keyof T]: T[K] extends Namespace<infer NS>
    ? { [K2 in keyof NS]: NS[K2] extends ImplementedContract<...> ? /* curried shape */ : never }
    : T[K] extends ImplementedContract<...> ? /* existing flat shape */ : never
};
```

Use clean helper types (e.g., `ExtractNamespaceContracts<T>`) to avoid deeply nested inline types.

### Validation
```bash
pnpm build      # 0 errors
pnpm test:run   # all existing tests still pass
git add src/core/serviceFrom.ts && git commit -m "feat: extend type utilities for namespace support"
```

---

## Task 2.1 — Runtime wiring in `src/core/serviceFrom.ts`

**Touch ONLY:** `src/core/serviceFrom.ts`
**Estimate:** 60–90 min

Add namespace-detection branches to the `serviceFrom` and `serviceFromSimple` runtime loops.

### TDD checklist (add these tests to `src/core/serviceFrom.ts`? — NO. Write them in a temporary inline test or confirm they will be covered by Task 3.1. For this task, write the failing assertions as comments and implement until `pnpm build` and `pnpm test:run` pass.)

Actually: the tests for the runtime behavior will be written as part of Task 3.1. For this
task, implement the runtime branches so that Task 3.1's tests will pass. After implementing,
run `pnpm build` and `pnpm test:run` to confirm no regressions.

### What to add

In `serviceFrom` (line ~170):
```typescript
for (const [commandName, contract] of Object.entries(commands)) {
  if (contract && typeof contract === 'object' && NAMESPACE_TAG in contract) {
    // Namespace branch: build a nested object
    const ns = contract as Namespace<any>;
    const nestedService: Record<string, any> = {};
    for (const [cmdName, innerContract] of Object.entries(ns.contracts)) {
      const curried = (innerContract as ImplementedContract<any,any,any,any,any>).withDependencies(deps);
      nestedService[cmdName] = {
        schemas: (innerContract as any).schemas,
        types: (innerContract as any).types,
        errors: (innerContract as any).errors,
        validateInput: (innerContract as any).validateInput,
        validateOutput: (innerContract as any).validateOutput,
        run: curried,
      };
    }
    service[commandName as keyof T] = nestedService as any;
  } else {
    // existing flat path (unchanged)
    const curriedCommand = (contract as ImplementedContract<any,any,any,any,any>).withDependencies(deps);
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
```

Apply the equivalent namespace branch to `serviceFromSimple` as well.

### Validation
```bash
pnpm build
pnpm test:run
git add src/core/serviceFrom.ts && git commit -m "feat: add namespace runtime wiring to serviceFrom and serviceFromSimple"
```

---

## Task 2.2 — Extend `src/core/defineService.ts`

**Touch ONLY:** `src/core/defineService.ts`
**Estimate:** 60–90 min

Update `ImplementedContractsFrom`, `ServiceContract`, and the `implementation` loop.

### TDD checklist (same note as 2.1 — tests are written in Task 3.1; implement so they will pass)

### What to change

Import `Namespace` and `NAMESPACE_TAG` from `./defineNamespace`.

**`ImplementedContractsFrom<T>`**: For namespace values, pass them through unchanged (they
already contain `ImplementedContract` values). For flat `Contract` values, keep existing behavior.

**`ServiceContract.types`**: `Dependencies` and `Errors` must include contributions from
namespace values. Reuse the updated `MergeDependencies`/`MergeErrors` from Task 1.2 — these
already handle namespaces, so the types should update automatically once the input type is
correct.

**`implementation` loop** (line ~148): Add namespace-detection branch mirroring Task 2.1.

**Missing-implementation guard** (line ~138): For namespace keys, check that the
provided `implementations[key]` is itself a `Namespace` whose `.contracts` contains the same
keys as the original namespace. Adjust the error message to report which sub-command is missing.

### Validation
```bash
pnpm test:run src/core/defineService
pnpm build
git add src/core/defineService.ts && git commit -m "feat: extend defineService to support namespaces"
```

---

## Task 3.1 — Tests, export, and JSDoc

**Touch ONLY:** `src/core/defineNamespace.test.ts` (new file), `src/core/defineNamespace.ts` (JSDoc only), `src/index.ts`
**Estimate:** 105–150 min

Write ALL tests before running any. Use `src/core/defineService.test.ts:1-64` as the template
for file structure and `src/core/defineService.test.ts:325-366` for `expectTypeOf` patterns.

### TDD checklist — write every test before running `pnpm test:run`

**Standalone metadata tests:**
- [ ] `const ns = defineNamespace({ create: createUserContract }); expect(ns.contracts.create).toBe(createUserContract)`
- [ ] `expect(NAMESPACE_TAG in ns).toBe(true)`
- [ ] Type: `expectTypeOf<typeof ns.types.Dependencies>().toEqualTypeOf<{ userRepo: UserRepo }>()`
- [ ] Type: errors union of standalone namespace is typed correctly

**Structure tests:**
- [ ] `defineNamespace({})` returns object with `contracts`, `types`, `NAMESPACE_TAG` properties
- [ ] Nested namespace throws: `expect(() => defineNamespace({ sub: defineNamespace({}) })).toThrow('defineNamespace: nested namespaces are not supported')`

**`serviceFrom` tests:**
- [ ] With namespace: `service.users.create.run(input)` resolves correctly
- [ ] With namespace: `service.users.create.schemas.input` is defined
- [ ] With namespace: `service.users.create.errors` is defined
- [ ] With namespace: `service.users.create.validateInput` and `validateOutput` are functions
- [ ] Mixed flat + namespace: `service.getUser.run(...)` (flat) and `service.users.create.run(...)` (namespaced) both succeed in the same instance

**`serviceFromSimple` tests:**
- [ ] With namespace: `service.users.create(input)` resolves correctly (curried, no `.run`)

**`defineService` tests:**
- [ ] `defineService({ users: defineNamespace({ create: createUserContract }) })` creates valid contract
- [ ] `.implementation({ users: defineNamespace({ create: createUserImpl }) })` wires correctly
- [ ] `service.users.create.run(input)` resolves from `defineService` path

**Merge tests:**
- [ ] Dependencies merge: creating service requires ALL deps from ALL commands (flat and namespaced) — missing dep causes TypeScript error (`@ts-expect-error`)
- [ ] Errors merge: `expectTypeOf<typeof result.error>()` includes error types from namespaced commands
- [ ] Type: `expectTypeOf<typeof service.users.create.run>()` is a function type with no `any`
- [ ] Type: `MergeDependencies` with namespace equals intersection of all deps

**Regression:**
- [ ] Run `pnpm test:run` and confirm zero regressions in existing test files

**After all tests are green:**
- [ ] Add to `src/index.ts` (keep alphabetical): `export * from './core/defineNamespace';`
- [ ] Run `pnpm build` to confirm `dist/` exposes `defineNamespace` and `Namespace`
- [ ] Add JSDoc to `Namespace` interface in `defineNamespace.ts` following `src/core/defineService.ts:40-73` style
- [ ] Add JSDoc to `defineNamespace` function following `src/core/defineService.ts:76-122` style

### Validation
```bash
pnpm test:run src/core/defineNamespace
pnpm build
pnpm test:run
git add src/core/defineNamespace.test.ts src/core/defineNamespace.ts src/index.ts \
  && git commit -m "feat: add defineNamespace tests, export, and JSDoc"
```

---

## Task 3.2 — Final integration smoke test

**Touch ONLY:** `src/core/defineNamespace.test.ts` (append only)
**Estimate:** 30–45 min

Append a single `describe('end-to-end integration (issue #7)')` block that uses the exact API
shapes from the issue. Cover all three service-creation paths in one test suite.

### TDD checklist

```typescript
// defineService with users + posts namespaces
const appContract = defineService({
  users: defineNamespace({ create: createUserContract, get: getUserContract }),
  posts: defineNamespace({ create: createPostContract, publish: publishPostContract }),
});

// serviceFrom with one flat command + one namespace
const createMixedService = serviceFrom({
  health: healthContract.implementation(healthImpl),
  users: defineNamespace({ create: createUserContract.implementation(createUserImpl) }),
});

// serviceFromSimple with namespaces
const createSimpleService = serviceFromSimple({
  users: defineNamespace({ create: createUserContract.implementation(createUserImpl) }),
});
```

Assertions:
- [ ] `appContract` path: `service.users.create.run(input)` succeeds
- [ ] `appContract` path: `service.posts.publish.run(input)` succeeds
- [ ] `appContract` path: `service.users.create.schemas.input` is defined
- [ ] `serviceFrom` mixed path: `service.health.run(...)` (flat) succeeds
- [ ] `serviceFrom` mixed path: `service.users.create.run(...)` (namespaced) succeeds in same instance
- [ ] `serviceFromSimple` path: `service.users.create(input)` resolves (no `.run`)
- [ ] Dep injection: creating any service above with incomplete deps causes a TypeScript error (`@ts-expect-error`)

### Validation
```bash
pnpm test:run
pnpm build
git add src/core/defineNamespace.test.ts && git commit -m "feat: add defineNamespace end-to-end integration tests"
```

---

## Done Criteria

The feature is complete when:

1. `pnpm build` exits 0
2. `pnpm test:run` exits 0 with all tests (old + new) passing
3. All 5 git commits exist (one per task)
4. `defineNamespace` and `Namespace` are importable from `@validkeys/contracted`
5. `service.users.create.run(...)` works through all three service-creation paths
6. No existing test file has been modified

Report a summary of:
- Files created/modified
- Test count added
- Any deviations from the plan and how they were resolved
