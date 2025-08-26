# @validkeys/contracted

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
