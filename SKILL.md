---
name: contracted
description: Use when building TypeScript services with @validkeys/contracted, defineCommand, defineService, defineNamespace, defineError, or the service-command pattern. Covers contract definition, implementation, namespace grouping, dependency injection, error handling with TaggedErrors, and service composition with Zod validation.
license: ISC
compatibility: TypeScript project with @validkeys/contracted, neverthrow, and zod installed as peer dependencies
metadata:
  package: "@validkeys/contracted"
  version: "4.x"
---

# Contracted — @validkeys/contracted

Contract-first TypeScript library for type-safe, composable services with automatic Zod validation and tagged error handling via neverthrow.

**Install:** `pnpm add @validkeys/contracted neverthrow zod`

**Workflow order:** Errors → Commands → (Namespaces) → Service Contract → Implementations → Service Factory

---

## Step 1: Define Errors

```typescript
import { defineError } from '@validkeys/contracted';

export const UserNotFoundError = defineError<'USER_NOT_FOUND', { userId: string }>(
  'USER_NOT_FOUND',
  'User not found'
);
```

- Tag must be `SCREAMING_SNAKE_CASE` and unique across the system
- Data payload carries context needed for error messages
- Group related errors: `export const writeErrors = [UserAlreadyExistsError, ...] as const`

---

## Step 2: Define Commands (Contracts)

```typescript
import { z } from 'zod';
import { defineCommand } from '@validkeys/contracted';

// contracts/infrastructure.ts — shared interfaces, no business logic
export interface UserRepository {
  findById: (id: string) => Promise<User | null>;
  save: (user: User) => Promise<void>;
}

export const getUserCommand = defineCommand({
  input: z.object({ userId: z.string().trim() }),
  output: z.object({ id: z.string(), name: z.string(), email: z.string() }),
  dependencies: {
    userRepo: {} as UserRepository,  // typed stub — not a real instance
    logger: {} as Logger,
  },
  options: {} as { includeDeleted?: boolean },  // optional per-call flags
  errors: [UserNotFoundError] as const,          // must be as const
});

export type GetUserInput = typeof getUserCommand.types.Input;
export type GetUserOutput = typeof getUserCommand.types.Output;
```

---

## Step 3: Define Service Contract

```typescript
import { defineService } from '@validkeys/contracted';

export const userServiceContract = defineService({
  getUser: getUserCommand,
  createUser: createUserCommand,
});

// Types available immediately — before any implementation exists
export type UserService = typeof userServiceContract.types.Service;
export type UserServiceDeps = typeof userServiceContract.types.Dependencies;
export type UserServiceErrors = typeof userServiceContract.types.Errors;
```

`Dependencies` is an **intersection** of all commands' deps — the service factory requires *every* dep from *every* command.

---

## Step 4: Implement Commands

### Recommended: `implementation()` — auto-wrapped

```typescript
export const getUser = getUserCommand.implementation(async ({ input, deps, options }) => {
  // input is already validated and Zod-transformed before this runs
  const user = await deps.userRepo.findById(input.userId);
  if (!user) throw new UserNotFoundError({ userId: input.userId }); // caught → err()
  return user; // validated against output schema → ok()
  // ⚠️ Do NOT return ok(user) — the raw value is expected, not a Result
});
```

- `ValidationError` is automatically added to the error union
- Non-`TaggedError` throws are re-thrown, not swallowed

To wrap infrastructure exceptions, use the `cause` argument:
```typescript
try {
  await deps.userRepo.save(user);
} catch (e) {
  throw new UserRepositoryError({ op: 'save' }, 'DB write failed', e);
}
```

### Alternative: `unsafeImplementation()` — explicit Results

```typescript
import { ok, err } from 'neverthrow';

export const getUser = getUserCommand.unsafeImplementation(async ({ input, deps }) => {
  const user = await deps.userRepo.findById(input.userId);
  if (!user) return err(new UserNotFoundError({ userId: input.userId }));
  return ok(user); // explicit Result required; no automatic validation
});
```

Use when: migrating Result-based code, or needing fine-grained validation control.

---

## Step 5: Compose the Service

```typescript
export const createUserService = userServiceContract.implementation({
  getUser,
  createUser,
  // throws at runtime if any command from the contract is missing
});
```

---

## Step 6: Use the Service

```typescript
// Inject all deps (intersection of every command's dependencies)
const userService = createUserService({
  userRepo: new UserRepository(),
  logger: new Logger(),
});

// Service commands: run(input, options?)
const result = await userService.getUser.run({ userId: '123' });

if (result.isOk()) {
  console.log(result.value);
} else {
  // result.error = discriminated union of declared errors + ValidationError
}
```

**Standalone contract** (before service composition) uses a different signature:
```typescript
// run({ input, deps, options? }) — context object, not positional
const result = await getUser.run({ input: { userId: '123' }, deps: { userRepo } });
```

---

## Error Handling

### `matchError()` — exhaustive pattern matching (preferred)

```typescript
import { matchError } from '@validkeys/contracted';

if (result.isErr()) {
  return matchError(result.error, {
    VALIDATION_ERROR: (e) => ({ status: 400, errors: e.data.errors }),
    USER_NOT_FOUND: (e) => ({ status: 404, message: `No user: ${e.data.userId}` }),
  });
}
```

### `switch` on `_tag` — with exhaustiveness check

```typescript
if (result.isErr()) {
  switch (result.error._tag) {
    case 'VALIDATION_ERROR':
      // .data.phase = 'input' | 'output'
      // .data.errors = simplified array
      // .data.zodError = full ZodError (.format(), .flatten(), .issues)
      break;
    case 'USER_NOT_FOUND': break;
    default:
      const _: never = result.error;
  }
}
```

---

## Without Service Contracts (Simple Composition)

```typescript
import { serviceFrom, serviceFromSimple } from '@validkeys/contracted';

// Full metadata — commands called via .run(input, options?)
const userService = serviceFrom({ getUser, createUser })(deps);
const result = await userService.getUser.run({ userId: '123' });

// Execution only — commands ARE the function, no .run()
const userService = serviceFromSimple({ getUser, createUser })(deps);
const result = await userService.getUser({ userId: '123' }); // ← no .run()
```

---

## Namespaces

Group related commands under a nested key with `defineNamespace`. Works with all three service-creation paths.

```
service.users.create.run(input)   // namespace "users", command "create"
service.health.run(input)         // flat command — unchanged
```

### Define

```typescript
import { defineNamespace } from '@validkeys/contracted';

const usersNamespace = defineNamespace({
  create: createUserCommand,
  get:    getUserCommand,
});
```

- Accepts `Contract` or `ImplementedContract` values.
- Nesting a `Namespace` inside a `Namespace` **throws at runtime** — one level deep only.

### Use with `defineService`

```typescript
export const appContract = defineService({
  health: healthCommand,
  users: defineNamespace({ create: createUserCommand, get: getUserCommand }),
  posts: defineNamespace({ create: createPostCommand }),
});

// Implement — wrap implementations in defineNamespace too
export const createAppService = appContract.implementation({
  health: healthCommand.implementation(healthImpl),
  users: defineNamespace({
    create: createUserCommand.implementation(createUserImpl),
    get:    getUserCommand.implementation(getUserImpl),
  }),
  posts: defineNamespace({ create: createPostCommand.implementation(createPostImpl) }),
});

const service = createAppService({ userRepo, postRepo, ... });
await service.users.create.run({ name: 'Alice', email: 'alice@example.com' });
await service.health.run({});   // flat commands work alongside namespaced ones
```

### Use with `serviceFrom` / `serviceFromSimple`

```typescript
// serviceFrom — full metadata on each namespaced command
const createAppService = serviceFrom({
  health: healthCommand.implementation(healthImpl),
  users: defineNamespace({ create: createUserCommand.implementation(createUserImpl) }),
});
const service = createAppService({ userRepo });
await service.users.create.run(input);     // .run()
service.users.create.schemas.input;        // Zod schema accessible

// serviceFromSimple — no metadata, call directly
const createSimple = serviceFromSimple({
  users: defineNamespace({ create: createUserCommand.implementation(createUserImpl) }),
});
const simple = createSimple({ userRepo });
await simple.users.create(input);          // no .run()
```

### Dependency Merging

Deps from all namespaced commands are merged into the top-level intersection — provide them all when creating the service:

```typescript
// users.create requires { userRepo }, posts.publish requires { postRepo }
const service = createAppService({ userRepo, postRepo });
```

### Missing-implementation guard

If a namespace key is passed a plain object instead of a `Namespace`, or if a sub-command is missing, `serviceContract.implementation()` throws descriptively:

```
Missing namespace implementation for contract: users. Expected a Namespace object.
Missing implementation for contract: users.get
```

---

## `withDependencies` — Pre-inject Dependencies

```typescript
// Returns CurriedImplementation: (input, options?) => Promise<Result<...>>
const getUserWithDeps = getUser.withDependencies({ userRepo, logger });
const result = await getUserWithDeps({ userId: '123' });
```

Useful for testing individual commands without a full service factory.

---

## Type Extraction

```typescript
// From a command
type Input = typeof myCommand.types.Input;
type Output = typeof myCommand.types.Output;
type Deps = typeof myCommand.types.Dependencies;

// From a service contract
type Service = typeof myServiceContract.types.Service;
type ServiceDeps = typeof myServiceContract.types.Dependencies;

// From serviceFrom collections
import type { ServiceDependencies, ServiceErrors } from '@validkeys/contracted';
type Deps = ServiceDependencies<typeof commandMap>;
type Errors = ServiceErrors<typeof commandMap>;
```

---

## Manual Validation

`validateInput` and `validateOutput` are available on both standalone contracts and service commands. Both throw `ZodError` on failure.

```typescript
const validInput = myCommand.validateInput(rawData);
const validInput = userService.getUser.validateInput(rawData);
```

---

## Recommended File Structure

```
src/
├── contracts/                  # No business logic
│   ├── infrastructure.ts       # Shared interfaces (Logger, Repository, etc.)
│   └── UserManager/
│       ├── errors.ts           # defineError calls
│       ├── contracts.ts        # defineCommand calls
│       ├── service.ts          # defineService + exported types
│       └── index.ts
└── UserManager/                # Imports from contracts, never the reverse
    ├── commands/
    │   ├── getUser.ts
    │   └── createUser.ts
    ├── service.ts              # serviceContract.implementation({...})
    └── index.ts
```

---

## Known Limitations

- **Async Zod refinements are not supported.** `z.string().refine(async () => ...)` silently passes because the library uses `.safeParse()` (sync). Validate async invariants inside the implementation body and throw a `TaggedError`.
- **`defineContract` is deprecated.** Alias for `defineCommand` — use `defineCommand` in all new code.
- **Namespaces are one level deep only.** Nesting a `Namespace` inside a `Namespace` throws at runtime. Enforce grouping depth at the architecture level, not in code.

---

## When NOT to Use

- Simple utility functions with no dependencies or typed errors
- One-off scripts
- Functions that cannot fail and need no dependency injection
