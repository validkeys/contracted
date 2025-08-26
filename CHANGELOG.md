# @validkeys/contracted

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
