---
name: build
description: Build the contracted TypeScript library. Use when asked to build, compile, or run tsc. Covers running the build, understanding the output, and diagnosing compile errors.
---

# Build Skill — @validkeys/contracted

## Overview

The build compiles TypeScript source from `src/core/` into `dist/` using `tsc`. The example folder and all test files are excluded from the build output intentionally — only library source ships.

## Commands

```bash
# Standard build (outputs to dist/)
pnpm build

# Type-check without emitting files (faster feedback)
pnpm tsc --noEmit

# Watch mode (re-compiles on save)
pnpm tsc --watch
```

## What Gets Compiled

**Included** (`tsconfig.json` → `include: ["src/**/*"]`):
- `src/core/defineContract.ts`
- `src/core/defineService.ts`
- `src/core/serviceFrom.ts`
- `src/core/errors.ts`
- `src/core/types.ts`
- `src/index.ts`

**Excluded** (`tsconfig.json` → `exclude`):
- `**/*.test.ts` — vitest tests never ship
- `src/example/**/*` — example code never ships
- `node_modules`, `dist`

## Output Structure

After `pnpm build`, `dist/` mirrors `src/core/`:

```
dist/
  index.js          # ESM entry (main)
  index.d.ts        # Type declarations entry (types)
  core/
    defineContract.js / .d.ts
    defineService.js / .d.ts
    serviceFrom.js / .d.ts
    errors.js / .d.ts
    types.js / .d.ts
```

`package.json` points consumers to:
- `"main": "dist/index.js"`
- `"types": "dist/index.d.ts"`
- `"files": ["dist"]` — only `dist/` is packed and published

## Compiler Settings

| Setting | Value | Why |
|---|---|---|
| `target` | `ES2022` | Modern Node.js; async/await native |
| `module` | `NodeNext` | ESM with `.js` extensions in imports |
| `moduleResolution` | `NodeNext` | Matches NodeNext module |
| `strict` | `true` | Full strict mode |
| `declaration` | `true` | Emits `.d.ts` files for consumers |
| `outDir` | `./dist` | Compiled output directory |

## Common Build Errors

### Missing `.js` extension in imports
NodeNext requires explicit `.js` extensions on relative imports in source TypeScript files:
```typescript
// ✅ correct
import { foo } from './foo.js'
// ❌ wrong — will fail at runtime
import { foo } from './foo'
```

### Type errors in test or example files
Tests and examples are excluded from the build. If `tsc` flags them, it may be because a path in `tsconfig.json` changed. Run `pnpm tsc --noEmit` to confirm scope, or check that `exclude` in `tsconfig.json` still covers `**/*.test.ts` and `src/example/**/*`.

### Stale `dist/` artifacts
If you rename or delete a source file, old `.js`/`.d.ts` files in `dist/` may linger. Clean before rebuilding:
```bash
rm -rf dist && pnpm build
```

## Verification

After a successful build, confirm the entry points exist:
```bash
ls dist/index.js dist/index.d.ts
```

Run the test suite (uses source files, not dist) to confirm nothing is broken:
```bash
pnpm test:run
```
