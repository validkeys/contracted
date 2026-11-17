---
"@validkeys/contracted": patch
---

Fix `Namespace<T>` variance bug that caused TS2322 in stricter compilers (tsgo / TypeScript 7+).

`MergeDependencies<T>` uses `UnionToIntersection`, which places `T` in a contravariant position and made `Namespace<T>` invariant. This prevented assigning `Namespace<{ create: Contract<...> }>` to `Namespace<Record<string, NamespaceContractValue>>` without a cast, breaking consumers that use tsgo or TypeScript 7.

The fix splits `Namespace<T>` into two interfaces: the structural `Namespace<T>` (covariant — only `readonly [NAMESPACE_TAG]` and `readonly contracts`) and `ConcreteNamespace<T>` (extends `Namespace<T>`, adds the `types` block). `defineNamespace()` returns `ConcreteNamespace<T>`, so `typeof ns.types.Dependencies` patterns continue to work via inferred return type. No API changes.
