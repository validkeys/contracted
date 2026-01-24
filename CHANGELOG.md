# @validkeys/contracted

## 4.0.0

### Major Changes

- **BREAKING CHANGE: Automatic input/output validation in `implementation()` method**

  The `implementation()` method now automatically validates inputs and outputs using the defined Zod schemas. This aligns the actual behavior with the documented "automatic validation" feature and ensures runtime type safety.

  ## What Changed

  - **Input validation**: Inputs are validated and transformed BEFORE your implementation runs
  - **Output validation**: Outputs are validated and transformed BEFORE returning success
  - **ValidationError added**: A new `VALIDATION_ERROR` type is automatically added to all contracts using `implementation()`
  - **Zod transformations applied**: `.trim()`, `.default()`, `.transform()`, etc. are now applied automatically
  - **unsafeImplementation unchanged**: The `unsafeImplementation()` method skips validation (escape hatch)

  ## Migration Guide

  ### Option 1: Embrace automatic validation (Recommended)

  ```typescript
  // Before (v3.x): Manual validation required
  const getUser = getUserCommand.implementation(async ({ input, deps }) => {
    const validInput = getUserCommand.validateInput(input); // Manual
    const user = await deps.userRepo.findById(validInput.userId);
    if (!user) {
      throw new UserNotFoundError({ userId: input.userId });
    }
    return user;
  });

  // After (v4.0.0): Automatic validation
  const getUser = getUserCommand.implementation(async ({ input, deps }) => {
    // input is already validated and transformed
    const user = await deps.userRepo.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError({ userId: input.userId });
    }
    return user;
  });

  // Handle validation errors
  const result = await getUser.run({ input, deps });
  if (result.isErr()) {
    switch (result.error._tag) {
      case "VALIDATION_ERROR":
        console.error(
          "Invalid:",
          result.error.data.phase,
          result.error.data.errors
        );
        break;
      case "USER_NOT_FOUND":
        console.error("Not found:", result.error.data.userId);
        break;
    }
  }
  ```

  ### Option 2: Use unsafeImplementation() for full control

  ```typescript
  // No automatic validation - same behavior as v3.x
  const getUser = getUserCommand.unsafeImplementation(
    async ({ input, deps }) => {
      const validInput = getUserCommand.validateInput(input); // Manual
      const user = await deps.userRepo.findById(validInput.userId);
      if (!user) {
        return err(new UserNotFoundError({ userId: input.userId }));
      }
      return ok(user);
    }
  );
  ```

  ## Breaking Changes

  1. **ValidationError in error union**: All contracts using `implementation()` now include `VALIDATION_ERROR` in their error union. Update exhaustive error matching to handle this case.

  2. **Input transformations applied**: Implementations receive Zod-transformed inputs (trimmed strings, coerced numbers, etc.). If you relied on raw untransformed input, switch to `unsafeImplementation()`.

  3. **Output validation required**: Implementations must return valid outputs matching the output schema. Invalid outputs will return `VALIDATION_ERROR` instead of passing through.

  ## New ValidationError Type

  ```typescript
  {
    _tag: 'VALIDATION_ERROR',
    data: {
      phase: 'input' | 'output',  // Which validation failed
      errors: Array<{
        path: (string | number)[], // Field path (e.g., ['user', 'email'])
        message: string,            // Error message
        code: string                // Zod error code
      }>,
      message: string               // Human-readable summary
    }
  }
  ```

  ## Benefits

  - ✅ Runtime type safety - invalid data never reaches your implementation
  - ✅ Automatic Zod transformations - defaults, trims, coercions work automatically
  - ✅ Cleaner code - no manual validation boilerplate
  - ✅ Consistent behavior - validation happens in one place
  - ✅ Better error messages - detailed validation errors with field paths

## 3.0.4

### Patch Changes

- Fix MergeDependencies type to create intersection instead of union (fixes #5)

  The `MergeDependencies` type was incorrectly creating a union of dependencies from different service commands instead of an intersection. This allowed TypeScript to accept incomplete dependency objects at service initialization, leading to runtime errors that should have been caught at compile time.

  **What changed:**

  - Added `UnionToIntersection` utility type
  - Fixed `MergeDependencies` to properly merge all dependencies using intersection
  - Added regression test using `expect-type` to prevent this bug from reoccurring

  **Impact:**
  Services with multiple commands that have different dependency requirements will now correctly require ALL dependencies from ALL commands. Code that was previously compiling with incomplete dependencies will now show TypeScript errors, preventing runtime crashes.

  **Example:**

  ```typescript
  // Before (incorrect): Union allowed partial deps
  type Deps = { db; serviceA; logger } | { db; logger };
  // TypeScript accepted: { db, logger } ❌

  // After (correct): Intersection requires all deps
  type Deps = { db; serviceA; logger } & { db; logger };
  // Simplified to: { db, serviceA, logger } ✅
  ```

## 3.0.3

### Patch Changes

- Fix missing unsafeImplementation method in published types - rebuilt dist folder to include latest TypeScript definitions

## 3.0.2

### Patch Changes

- ad76d70: Fix repository and homepage URLs to point to validkeys organization

## 3.0.1

### Patch Changes

- f014a4f: Add defineContract tests and improve type definitions

## 3.0.0

### Major Changes

- BREAKING CHANGE: Rename `defineContract` to `defineCommand` for better naming consistency

  - **New primary API**: `defineCommand` replaces `defineContract` for defining individual operations
  - **Consistent naming**: `defineCommand` + `defineService` provides clear distinction between individual operations and service collections
  - **Backwards compatibility**: `defineContract` is still available as a deprecated alias until v4.0.0
  - **Updated examples**: All documentation and examples now use the new `defineCommand` API
  - **Migration path**: Replace `defineContract` imports with `defineCommand` - functionality is identical

  **Before:**

  ```typescript
  import { defineContract, defineService } from "@validkeys/contracted";

  const getUserContract = defineContract({
    /* ... */
  });
  const serviceContract = defineService({ getUser: getUserContract });
  ```

  **After:**

  ```typescript
  import { defineCommand, defineService } from "@validkeys/contracted";

  const getUserCommand = defineCommand({
    /* ... */
  });
  const serviceContract = defineService({ getUser: getUserCommand });
  ```

  This change provides better conceptual clarity: **Commands** define individual operations, **Services** define collections of operations.

## 2.0.1

### Patch Changes

- Fix Quick Start example to showcase defineService as primary approach

  - Updated Quick Start to use `defineService` instead of `serviceFrom`
  - Shows complete service contract definition and implementation pattern
  - Highlights immediate type availability after service contract definition
  - References `serviceFrom` as alternative for simple applications

  The Quick Start now properly demonstrates the recommended approach for most applications.

## 2.0.0

### Major Changes

- 3e7324f: Initial release of Contracted - a TypeScript library for building type-safe, composable services using a contract-first approach.

  Features:

  - Contract-first service definition with Zod validation
  - Type-safe error handling with tagged errors
  - Dependency injection support
  - Service composition utilities
  - Full TypeScript support with comprehensive type inference

### Minor Changes

- Add `defineService` for service contract definition

  - **New `defineService` function**: Creates service contracts that provide types before implementation exists
  - **Service Contracts**: Enable clean separation between contract definition and implementation across packages
  - **Consistent API**: Follows the same `define → implementation` pattern as individual contracts
  - **Cross-Package Types**: Service types available in contracts folder for other packages to import
  - **Full Test Coverage**: Comprehensive test suite with Vitest
  - **Documentation**: Service contracts documented as core concept alongside command contracts

  This enables type-driven development where service interfaces can be defined in a global contracts folder and implemented separately in packages, maintaining clean boundaries and full type safety.

  **Example Usage:**

  ```typescript
  // contracts/UserManager/service.ts
  const serviceContract = defineService({
    createUser: createUserContract,
    updateUser: updateUserContract,
  });

  // Types available immediately
  export type UserService = typeof serviceContract.types.Service;

  // packages/UserManager/service.ts
  export const createUserService = serviceContract.implementation({
    createUser: createUserImpl,
    updateUser: updateUserImpl,
  });
  ```
