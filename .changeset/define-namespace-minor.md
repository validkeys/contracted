---
"@validkeys/contracted": minor
---

Add `defineNamespace()` for grouped command routing.

Groups related commands under a nested key so callers use `service.users.create.run(input)` instead of flat `service.createUser.run(input)`. Works with all three service-creation paths — `defineService`, `serviceFrom`, and `serviceFromSimple`.

- New export: `defineNamespace(contracts)` — accepts `Contract` or `ImplementedContract` values, returns a `Namespace<T>` tagged with `NAMESPACE_TAG`
- New export: `Namespace<T>` interface and `NAMESPACE_TAG` symbol
- `MergeDependencies` and `MergeErrors` now include deps/errors from namespaced commands
- `ServiceWithContracts` and `CurriedService` produce nested objects for namespace entries
- One-level depth enforced at runtime; descriptive error thrown for nested namespaces
- 45 new tests in `defineNamespace.test.ts`; 13 new tests in `errors.test.ts`
