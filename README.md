# Contracted

A TypeScript library for building type-safe, composable services using a contract-first approach. Define your operations with clear inputs, outputs, dependencies, and error types, then compose them into services with automatic dependency injection.

## Table of Contents

- [Installation](#installation)
- [Core Concepts](#core-concepts)
- [Quick Start](#quick-start)
- [Step-by-Step Guide](#step-by-step-guide)
  - [1. Define Errors](#1-define-errors)
  - [2. Define a Command](#2-define-a-command)
  - [3. Define a Service](#3-define-a-service)
  - [4. Implement the Command](#4-implement-the-command)
  - [5. Implement the Service](#5-implement-the-service)
  - [6. Use the Service](#6-use-the-service)
- [Service Contracts](#service-contracts)
- [Error Handling](#error-handling)
- [Advanced Features](#advanced-features)
- [API Reference](#api-reference)
- [Examples](#examples)

## Installation

```bash
npm install @validkeys/contracted
# or
pnpm add @validkeys/contracted
# or
yarn add @validkeys/contracted
```

Contracted has peer dependencies on `neverthrow` and `zod`:

```bash
npm install neverthrow zod
# or
pnpm add neverthrow zod  
# or
yarn add neverthrow zod
```

## Core Concepts

The Service Command architecture is built around four key concepts:

### 🔒 **Commands**
Define the interface for an operation including:
- **Input schema** (Zod validation)
- **Output schema** (Zod validation) 
- **Dependencies** (typed dependency injection)
- **Options** (optional configuration)
- **Errors** (typed error conditions)

### ⚡ **Implementations**
Implemented commands that contain the actual business logic. Implementations are pure functions that receive validated input and dependencies.

### 🏗️ **Services** 
Collections of related commands with shared dependencies. Services provide a clean API for executing multiple operations.

### 🏷️ **Tagged Errors**
Type-safe error handling using discriminated unions, enabling exhaustive pattern matching and precise error handling.

## Quick Start

```typescript
import { z } from 'zod';
import { defineCommand, defineError, defineService } from '@validkeys/contracted';

// 1. Define errors
const UserNotFoundError = defineError<'USER_NOT_FOUND', { userId: string }>(
  'USER_NOT_FOUND',
  'User not found'
);

// 2. Define command
const getUserCommand = defineCommand({
  input: z.object({ userId: z.string() }),
  output: z.object({ 
    id: z.string(), 
    name: z.string(), 
    email: z.string() 
  }),
  dependencies: {
    userRepo: {} as { findById: (id: string) => Promise<any | null> }
  },
  errors: [UserNotFoundError] as const
});

// 3. Define service contract
const userServiceContract = defineService({
  getUser: getUserCommand
});

// Types available immediately
type UserService = typeof userServiceContract.types.Service;
type UserServiceDeps = typeof userServiceContract.types.Dependencies;

// 4. Implement the service contract (using the new auto-wrapped implementation)
const getUser = getUserCommand.implementation(async ({ input, deps }) => {
  const user = await deps.userRepo.findById(input.userId);
  if (!user) {
    throw new UserNotFoundError({ userId: input.userId });
  }
  return user; // Automatically wrapped in ok() 
});

const createUserService = userServiceContract.implementation({
  getUser
});

// 5. Use the service
const userService = createUserService({
  userRepo: new UserRepository()
});

const result = await userService.getUser.run({ userId: '123' });
```

> **Note:** For simple applications, you can also use [`serviceFrom`](#service-variants) to create services directly from implementations without service contracts.

## Step-by-Step Guide

### 1. Define Errors

Start by defining the possible error conditions in your contracts package:

```typescript
// src/packages/contracts/UserManager/errors.ts
import { defineError } from './core/errors';

// Define specific error types with typed data
export const UserAlreadyExistsError = defineError<
  'USER_ALREADY_EXISTS', 
  { email: string }
>(
  'USER_ALREADY_EXISTS',
  'User with this email already exists'
);

export const UserNotFoundError = defineError<
  'USER_NOT_FOUND', 
  { userId: string }
>(
  'USER_NOT_FOUND',
  'User not found'
);

export const InvalidUserDataError = defineError<
  'INVALID_USER_DATA', 
  { field: string; reason: string }
>(
  'INVALID_USER_DATA',
  'Invalid user data provided'
);

// Group errors by operation
export const createUserErrors = [
  UserAlreadyExistsError,
  InvalidUserDataError,
] as const;
```

### 2. Define Commands

Create commands that specify interfaces and dependencies in your contracts package:

```typescript
// src/packages/contracts/infrastructure.ts
export interface UserRepository {
  save: (user: any) => Promise<void>;
  findByEmail: (email: string) => Promise<any | null>;
  findById: (id: string) => Promise<any | null>;
}

export interface IdGenerator {
  generate: () => string;
}

export interface Logger {
  info: (message: string, data?: any) => void;
  error: (message: string, error: Error) => void;
}

// src/packages/contracts/UserManager/contracts.ts
import { z } from 'zod';
import { defineCommand } from './core/defineCommand';
import { createUserErrors } from './errors';
import { UserRepository, IdGenerator, Logger } from '../infrastructure';

// Define the command
export const createUserCommand = defineCommand({
  input: z.object({
    email: z.string().email(),
    name: z.string().min(1).max(100),
    age: z.number().min(18).max(120),
  }),
  output: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    age: z.number(),
    createdAt: z.date(),
  }),
  dependencies: {
    userRepository: {} as UserRepository,
    idGenerator: {} as IdGenerator,
    logger: {} as Logger,
  },
  options: {} as {
    skipDuplicateCheck?: boolean;
    sendWelcomeEmail?: boolean;
  },
  errors: createUserErrors,
});
```

### 3. Define a Service

Create a service contract that groups related commands:

```typescript
// src/packages/contracts/UserManager/service.ts
import { defineService } from '@validkeys/contracted';
import { createUserCommand } from './contracts';

export const userManagerServiceContract = defineService({
  createUser: createUserCommand,
  // Add other commands here
  // updateUser: updateUserCommand,
  // deleteUser: deleteUserCommand,
});

// Export types for use in other packages
export type UserManagerService = typeof userManagerServiceContract.types.Service;
export type UserManagerDependencies = typeof userManagerServiceContract.types.Dependencies;
export type UserManagerErrors = typeof userManagerServiceContract.types.Errors;
```

### 4. Implement the Command

Add the business logic in your implementation package:

```typescript
// src/packages/UserManager/commands/createUser.ts
import { 
  createUserCommand,
  UserAlreadyExistsError,
  InvalidUserDataError,
  UserRepositoryError,
} from '../../contracts/UserManager/index';

export const createUser = createUserCommand.implementation(
  async ({ input, deps, options }) => {
    deps.logger.info('Creating user', { email: input.email });

    // Business logic validation - throw errors directly
    if (input.name.includes('@')) {
      throw new InvalidUserDataError({
        field: 'name',
        reason: 'Name cannot contain @ symbol'
      });
    }

    // Check for existing user
    if (!options?.skipDuplicateCheck) {
      try {
        const existingUser = await deps.userRepository.findByEmail(input.email);
        if (existingUser) {
          throw new UserAlreadyExistsError({ email: input.email });
        }
      } catch (error) {
        throw new UserRepositoryError({
          operation: 'findByEmail',
          details: error?.toString()
        });
      }
    }

    // Create new user
    const newUser = {
      id: deps.idGenerator.generate(),
      email: input.email,
      name: input.name,
      age: input.age,
      createdAt: new Date(),
    };

    // Save to repository
    try {
      await deps.userRepository.save(newUser);
      deps.logger.info('User created successfully', { userId: newUser.id });
      
      // Return the raw output - automatically wrapped in ok()
      return newUser;
    } catch (error) {
      deps.logger.error('Failed to create user', error as Error);
      throw new UserRepositoryError({
        operation: 'save',
        details: error?.toString()
      });
    }
  }
);
```

### 5. Implement the Service

Create the service implementation using the service contract:

```typescript
// src/packages/UserManager/service.ts
import { userManagerServiceContract, UserManagerService, UserManagerDependencies } from '../contracts/UserManager/service';
import { createUser } from './commands/createUser';
// Import other command implementations
// import { updateUser } from './commands/updateUser';
// import { deleteUser } from './commands/deleteUser';

export const createUserService = userManagerServiceContract.implementation({
  createUser,
  // Add other command implementations here
  // updateUser,
  // deleteUser,
});

// Re-export types for convenience
export type UserService = UserManagerService;
export type { UserManagerDependencies };
```

### 6. Use the Service

Initialize and use your service:

```typescript
// src/example/index.ts
import { createUserService, UserManagerDependencies } from './packages/UserManager';

// Initialize with dependencies
const userService = createUserService({
  userRepository: new UserRepository(),
  idGenerator: new IdGenerator(),
  logger: new Logger(),
});

// Execute commands
const result = await userService.createUser.run(
  { 
    email: 'john@example.com',
    name: 'John Doe',
    age: 30 
  },
  { 
    sendWelcomeEmail: true 
  }
);

if (result.isOk()) {
  console.log('User created:', result.value);
} else {
  console.error('Failed to create user:', result.error);
}
```

## Implementation Methods

Contracted provides two ways to implement commands, giving you flexibility in how you handle errors:

### 1. `implementation()` - Auto-wrapped (Recommended)

The default `implementation` method automatically wraps your return values and caught errors in neverthrow Results:

```typescript
const getUserCommand = defineCommand({
  input: z.object({ userId: z.string() }),
  output: z.object({ id: z.string(), name: z.string() }),
  dependencies: {} as { userRepo: UserRepository },
  errors: [UserNotFoundError] as const
});

// Auto-wrapped implementation - cleaner code
const getUser = getUserCommand.implementation(async ({ input, deps }) => {
  const user = await deps.userRepo.findById(input.userId);
  if (!user) {
    throw new UserNotFoundError({ userId: input.userId }); // Automatically wrapped in err()
  }
  return user; // Automatically wrapped in ok()
});

const result = await getUser.run({ input: { userId: '123' }, deps: { userRepo } });
// result is Result<User, UserNotFoundError>
```

**Benefits:**
- ✅ Cleaner, more readable code
- ✅ Standard JavaScript error handling with `throw`
- ✅ Automatic Result wrapping
- ✅ TaggedErrors are caught and wrapped in `err()`
- ✅ Unexpected errors are re-thrown for proper error handling

### 2. `unsafeImplementation()` - Explicit Results

For cases where you need full control over Result handling, use `unsafeImplementation`:

```typescript
// Explicit Result handling
const getUser = getUserCommand.unsafeImplementation(async ({ input, deps }) => {
  const user = await deps.userRepo.findById(input.userId);
  if (!user) {
    return err(new UserNotFoundError({ userId: input.userId })); // Explicit err()
  }
  return ok(user); // Explicit ok()
});

const result = await getUser.run({ input: { userId: '123' }, deps: { userRepo } });
// result is Result<User, UserNotFoundError>
```

**When to use `unsafeImplementation`:**
- 🔧 Complex error transformation logic
- 🔧 Fine-grained control over Result creation
- 🔧 Migrating from existing Result-based code
- 🔧 Performance-critical paths where you want explicit control

### Consistent API

Both methods produce identical `ImplementedContract` objects with the same API:

```typescript
// Both methods create contracts with identical interfaces
const safeContract = command.implementation(/* ... */);
const unsafeContract = command.unsafeImplementation(/* ... */);

// Same API available on both:
const result1 = await safeContract.run(context);
const result2 = await unsafeContract.run(context);
const curried1 = safeContract.withDependencies(deps);
const curried2 = unsafeContract.withDependencies(deps);
```

## Service Contracts

For large applications with multiple packages, you can define service contracts that provide types before implementation exists. This enables clean separation between contract definition and implementation across package boundaries, following the same `define → implementation` pattern as individual contracts.

### Define Service Contract
```typescript
// contracts/UserManager/service.ts
import { defineService } from '@validkeys/contracted';
import { createUserCommand, updateUserContract, deleteUserContract } from './contracts';

export const userManagerServiceContract = defineService({
  createUser: createUserCommand,
  updateUser: updateUserContract,
  deleteUser: deleteUserContract
});

// Types available immediately for other packages
export type UserManagerService = typeof userManagerServiceContract.types.Service;
export type UserManagerDependencies = typeof userManagerServiceContract.types.Dependencies;
export type UserManagerErrors = typeof userManagerServiceContract.types.Errors;
```

### Implement Service Contract
```typescript
// packages/UserManager/service.ts
import { userManagerServiceContract } from '../../contracts/UserManager/service';
import { createUser, updateUser, deleteUser } from './commands';

export const createUserManagerService = userManagerServiceContract.implementation({
  createUser,
  updateUser,
  deleteUser
});

// Type matches the contract exactly
export type UserService = typeof userManagerServiceContract.types.Service;
```

### Use Service Types Across Packages
```typescript
// packages/PackageA/handlers.ts
import type { UserManagerService } from '../../contracts/UserManager/service';

// Package A can depend on service type without importing implementation
export class UserHandler {
  constructor(private userService: UserManagerService) {}
  
  async handleCreateUser(data: any) {
    return this.userService.createUser.run(data);
  }
}
```

This pattern enables:
- **Type availability before implementation**: Service types available in contracts folder
- **Clean package boundaries**: Packages depend on contracts, not implementations
- **Consistent API**: Same `define → implementation` pattern as contracts
- **Better architecture**: Interface segregation across package boundaries

## Error Handling

The architecture provides type-safe error handling through tagged errors:

### Exhaustive Pattern Matching

```typescript
import { matchError } from './core/errors';

if (result.isErr()) {
  const response = matchError(result.error, {
    USER_ALREADY_EXISTS: (error) => ({
      status: 409,
      message: `User with email ${error.data.email} already exists`,
    }),
    INVALID_USER_DATA: (error) => ({
      status: 400,
      message: `Invalid ${error.data.field}: ${error.data.reason}`,
    }),
    USER_REPOSITORY_ERROR: (error) => ({
      status: 500,
      message: 'Database error occurred',
      details: error.data.details,
    }),
  });
  
  console.log('Error response:', response);
}
```

### Switch Statement (Type-Safe)

```typescript
if (result.isErr()) {
  switch (result.error._tag) {
    case 'USER_ALREADY_EXISTS':
      // Handle duplicate user
      break;
    case 'INVALID_USER_DATA':
      // Handle validation error
      break;
    case 'USER_REPOSITORY_ERROR':
      // Handle database error
      break;
    default:
      // TypeScript ensures exhaustiveness
      const _exhaustive: never = result.error;
      throw new Error(`Unhandled error: ${_exhaustive}`);
  }
}
```

## Advanced Features

### Service Variants

#### Full Service (with metadata)
```typescript
const userService = serviceFrom(commands);
// Access to: schemas, types, errors, validateInput, validateOutput, run
```

#### Simple Service (execution only)
```typescript
import { serviceFromSimple } from './core/serviceFrom';

const userService = serviceFromSimple(commands);
// Only execution functions available
```

### Input/Output Validation

```typescript
// Validate input before processing
try {
  const validInput = userService.createUser.validateInput(req.body);
  const result = await userService.createUser.run(validInput);
} catch (validationError) {
  // Handle validation error
}

// Validate output (useful for testing)
const validOutput = userService.createUser.validateOutput(result.value);
```

### Dependency Type Extraction

```typescript
import { ServiceDependencies, ServiceErrors } from './core/serviceFrom';

// Extract types from individual contracts
type CreateUserInput = typeof createUserCommand.types.Input;
type CreateUserOutput = typeof createUserCommand.types.Output;
type CreateUserDeps = typeof createUserCommand.types.Dependencies;

// Extract types from service collections
type UserServiceDeps = ServiceDependencies<typeof userCommands>;
type UserServiceErrors = ServiceErrors<typeof userCommands>;
```

### HTTP Integration Example

```typescript
export async function createUserHandler(req: Request, res: Response) {
  try {
    const input = userService.createUser.validateInput(req.body);
    const result = await userService.createUser.run(input, {
      sendWelcomeEmail: true,
    });
    
    if (result.isErr()) {
      const errorResponse = matchError(result.error, {
        USER_ALREADY_EXISTS: () => res.status(409).json({
          error: 'User already exists',
          code: 'DUPLICATE_USER',
        }),
        USER_REPOSITORY_ERROR: () => res.status(500).json({
          error: 'Internal server error',
          code: 'DB_ERROR',
        }),
        INVALID_USER_DATA: (error) => res.status(400).json({
          error: 'Invalid input',
          field: error.data.field,
          reason: error.data.reason,
        }),
      });
      
      return errorResponse;
    }
    
    return res.status(201).json({
      status: 'success',
      data: result.value,
    });
  } catch (validationError) {
    return res.status(400).json({
      error: 'Invalid request body',
      details: validationError,
    });
  }
}
```

## API Reference

### Core Functions

#### `defineCommand<TInput, TOutput, TDeps, TOptions, TErrors>(params)`
Creates a new command definition.

**Parameters:**
- `input: z.ZodType` - Zod schema for input validation
- `output: z.ZodType` - Zod schema for output validation  
- `dependencies: TDeps` - Type definition for dependencies
- `options?: TOptions` - Optional configuration type
- `errors?: TErrors` - Array of error constructors

**Returns:** `Contract` with two implementation methods:
- `implementation(impl)` - Auto-wrapped implementation (throws errors, returns raw output)
- `unsafeImplementation(impl)` - Explicit Result handling (returns `Result<TOutput, TError>`)

#### `defineError<TTag, TData>(tag, defaultMessage?)`
Creates a tagged error class.

**Parameters:**
- `tag: string` - Unique identifier for the error
- `defaultMessage?: string` - Default error message

#### `serviceFrom<T>(commands)`
Creates a service factory with full contract metadata.

#### `serviceFromSimple<T>(commands)`  
Creates a simplified service factory with only execution functions.

#### `defineService<T>(contracts)`
Creates a service contract definition from individual contracts.

**Parameters:**
- `contracts: Record<string, Contract>` - Object mapping command names to contract definitions

**Returns:** `ServiceContract<T>` - Service contract with types and implementation method

#### `matchError<TError, TResult>(error, handlers)`
Provides exhaustive pattern matching for tagged errors.

### Types

#### `Contract<TInput, TOutput, TDeps, TOptions, TErrors>`
Base contract interface without implementation.

#### `ImplementedContract<TInput, TOutput, TDeps, TOptions, TErrors>`
Contract interface with implementation and execution methods.

#### `ImplementationFunction<TInput, TOutput, TDeps, TOptions, TError>`
Type for explicit Result-based implementation functions (used with `unsafeImplementation`).

#### `UnsafeImplementationFunction<TInput, TOutput, TDeps, TOptions>`
Type for auto-wrapped implementation functions (used with `implementation`).

#### `ServiceContract<T>`
Service contract interface that provides types before implementation exists.

#### `TaggedError<TTag>`
Base class for all tagged errors.

#### `ErrorUnion<T>`
Creates discriminated union from error constructor array.

## Examples

The `src/example` folder contains a complete example showing:

- **User Management Service**: Creating, updating, and deleting users
- **Service Contracts**: Using `defineService` for type-safe service definitions
- **Error Handling**: Comprehensive error scenarios
- **Service Composition**: Building services from multiple commands
- **Cross-Package Types**: Type safety across package boundaries

### File Structure
```
src/
├── core/                           # Core library code
│   ├── defineCommand.ts           # Contract definition
│   ├── defineService.ts           # Service contract definition
│   ├── errors.ts                  # Error handling utilities
│   ├── serviceFrom.ts             # Service composition
│   └── types.ts                   # Type definitions
└── example/                       # Usage examples
    ├── index.ts                   # Example usage
    └── packages/
        ├── contracts/             # Contract definitions (interfaces)
        │   ├── infrastructure.ts  # Shared infrastructure interfaces
        │   └── UserManager/
        │       ├── contracts.ts   # Individual contracts
        │       ├── service.ts     # Service contract definition
        │       ├── errors.ts      # Error definitions
        │       └── index.ts       # Package exports
        └── UserManager/           # Implementation package
            ├── commands/
            │   └── createUser.ts  # Command implementation
            ├── service.ts         # Service composition
            └── index.ts           # Package exports
```

## Package Structure

The Service Command architecture uses a clean separation between contracts and implementations:

### Contracts Package (`contracts/`)
- **Purpose**: Defines interfaces, types, and error definitions
- **Contents**: 
  - `infrastructure.ts`: Shared infrastructure interfaces (Logger, Repository, etc.)
  - Service-specific contracts and error definitions
- **Benefits**: 
  - Clear API definitions independent of implementation
  - Shared infrastructure interfaces across services
  - Easy to share between teams
  - Enables contract-first development
  - Facilitates testing with mocks

### Implementation Packages (`UserManager/`, etc.)
- **Purpose**: Provides actual business logic implementations
- **Contents**: Command implementations, service composition
- **Benefits**:
  - Multiple implementations of same contracts
  - Clean separation of concerns
  - Easier testing and mocking
  - Better code organization

### Usage Example
```typescript
// Import contracts for type definitions
import { createUserCommand } from './contracts/UserManager';

// Import implementation for actual usage
import { createUserService } from './UserManager';

// Access types from the contract
type CreateUserInput = typeof createUserCommand.types.Input;
type CreateUserOutput = typeof createUserCommand.types.Output;
type UserManagerDeps = typeof createUserCommand.types.Dependencies;

// Use with full type safety
const service = createUserService(dependencies);
const result = await service.createUser.run(input);
```

## Benefits

✅ **Type Safety**: Full TypeScript support with compile-time error checking  
✅ **Dependency Injection**: Clean, testable dependency management  
✅ **Error Handling**: Exhaustive, type-safe error handling  
✅ **Validation**: Automatic input/output validation with Zod  
✅ **Composition**: Easy service composition from reusable commands  
✅ **Testing**: Pure functions make testing straightforward  
✅ **Documentation**: Self-documenting contracts with clear interfaces  

## License

ISC
