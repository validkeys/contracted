# Service Command Architecture

A TypeScript library for building type-safe, composable services using a contract-first approach. Define your operations with clear inputs, outputs, dependencies, and error types, then compose them into services with automatic dependency injection.

## Table of Contents

- [Installation](#installation)
- [Core Concepts](#core-concepts)
- [Quick Start](#quick-start)
- [Step-by-Step Guide](#step-by-step-guide)
  - [1. Define Errors](#1-define-errors)
  - [2. Define a Contract](#2-define-a-contract)
  - [3. Implement the Contract](#3-implement-the-contract)
  - [4. Create a Service](#4-create-a-service)
  - [5. Use the Service](#5-use-the-service)
- [Error Handling](#error-handling)
- [Advanced Features](#advanced-features)
- [API Reference](#api-reference)
- [Examples](#examples)

## Installation

```bash
npm install neverthrow zod
# or
pnpm add neverthrow zod
# or
yarn add neverthrow zod
```

## Core Concepts

The Service Command architecture is built around four key concepts:

### 🔒 **Contracts**
Define the interface for an operation including:
- **Input schema** (Zod validation)
- **Output schema** (Zod validation) 
- **Dependencies** (typed dependency injection)
- **Options** (optional configuration)
- **Errors** (typed error conditions)

### ⚡ **Commands**
Implemented contracts that contain the actual business logic. Commands are pure functions that receive validated input and dependencies.

### 🏗️ **Services** 
Collections of related commands with shared dependencies. Services provide a clean API for executing multiple operations.

### 🏷️ **Tagged Errors**
Type-safe error handling using discriminated unions, enabling exhaustive pattern matching and precise error handling.

## Quick Start

```typescript
import { z } from 'zod';
import { defineContract, defineError, serviceFrom } from './core';
import { ok, err } from 'neverthrow';

// 1. Define errors
const UserNotFoundError = defineError<'USER_NOT_FOUND', { userId: string }>(
  'USER_NOT_FOUND',
  'User not found'
);

// 2. Define contract
const getUserContract = defineContract({
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

// 3. Implement the contract
const getUser = getUserContract.implementation(async ({ input, deps }) => {
  const user = await deps.userRepo.findById(input.userId);
  if (!user) {
    return err(new UserNotFoundError({ userId: input.userId }));
  }
  return ok(user);
});

// 4. Create service
const createUserService = serviceFrom({ getUser });

// 5. Use the service
const userService = createUserService({
  userRepo: new UserRepository()
});

const result = await userService.getUser.run({ userId: '123' });
```

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

### 2. Define Contracts

Create contracts that specify interfaces and dependencies in your contracts package:

```typescript
// src/packages/contracts/UserManager/contracts.ts
import { z } from 'zod';
import { defineContract } from './core/defineContract';
import { createUserErrors } from './errors';

// Define dependency interfaces
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

// Define the contract
export const createUserContract = defineContract({
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

### 3. Implement the Contract

Add the business logic in your implementation package:

```typescript
// src/packages/UserManager/commands/createUser.ts
import { ok, err } from 'neverthrow';
import { 
  createUserContract,
  UserAlreadyExistsError,
  InvalidUserDataError,
  UserRepositoryError,
} from '../../contracts/UserManager/index';

export const createUser = createUserContract.implementation(
  async ({ input, deps, options }) => {
    try {
      deps.logger.info('Creating user', { email: input.email });

      // Business logic validation
      if (input.name.includes('@')) {
        return err(new InvalidUserDataError({
          field: 'name',
          reason: 'Name cannot contain @ symbol'
        }));
      }

      // Check for existing user
      if (!options?.skipDuplicateCheck) {
        const existingUser = await deps.userRepository.findByEmail(input.email);
        if (existingUser) {
          return err(new UserAlreadyExistsError({ email: input.email }));
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

      await deps.userRepository.save(newUser);
      deps.logger.info('User created successfully', { userId: newUser.id });

      return ok(newUser);
    } catch (error) {
      deps.logger.error('Failed to create user', error as Error);
      return err(new UserRepositoryError({
        operation: 'createUser',
        details: error?.toString()
      }));
    }
  }
);
```

### 4. Create a Service

Compose multiple commands into a service in your implementation package:

```typescript
// src/packages/UserManager/service.ts
import { serviceFrom } from './core/serviceFrom';
import { UserManagerDependencies } from '../contracts/UserManager';
import { createUser } from './commands/createUser';

export const createUserService = serviceFrom({
  createUser,
  // Add other commands here
  // deleteUser,
  // updateUser,
});

export type UserService = ReturnType<typeof createUserService>;
export type { UserManagerDependencies };
```

### 5. Use the Service

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

#### `defineContract<TInput, TOutput, TDeps, TOptions, TErrors>(params)`
Creates a new contract definition.

**Parameters:**
- `input: z.ZodType` - Zod schema for input validation
- `output: z.ZodType` - Zod schema for output validation  
- `dependencies: TDeps` - Type definition for dependencies
- `options?: TOptions` - Optional configuration type
- `errors?: TErrors` - Array of error constructors

#### `defineError<TTag, TData>(tag, defaultMessage?)`
Creates a tagged error class.

**Parameters:**
- `tag: string` - Unique identifier for the error
- `defaultMessage?: string` - Default error message

#### `serviceFrom<T>(commands)`
Creates a service factory with full contract metadata.

#### `serviceFromSimple<T>(commands)`  
Creates a simplified service factory with only execution functions.

#### `matchError<TError, TResult>(error, handlers)`
Provides exhaustive pattern matching for tagged errors.

### Types

#### `Contract<TInput, TOutput, TDeps, TOptions, TErrors>`
Base contract interface without implementation.

#### `ImplementedContract<TInput, TOutput, TDeps, TOptions, TErrors>`
Contract interface with implementation and execution methods.

#### `TaggedError<TTag>`
Base class for all tagged errors.

#### `ErrorUnion<T>`
Creates discriminated union from error constructor array.

## Examples

The `src/example` folder contains a complete example showing:

- **User Management Service**: Creating, updating, and deleting users
- **Error Handling**: Comprehensive error scenarios
- **Service Composition**: Building services from multiple commands
- **HTTP Integration**: Using services in web applications

### File Structure
```
src/
├── core/                           # Core library code
│   ├── defineContract.ts           # Contract definition
│   ├── errors.ts                  # Error handling utilities
│   ├── serviceFrom.ts             # Service composition
│   └── types.ts                   # Type definitions
└── example/                       # Usage examples
    ├── index.ts                   # Example usage
    └── packages/
        ├── contracts/             # Contract definitions (interfaces)
        │   └── UserManager/
        │       ├── contracts.ts   # Service contracts
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
- **Contents**: Service contracts, dependency interfaces, error types
- **Benefits**: 
  - Clear API definitions independent of implementation
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
import { UserManagerDependencies, CreateUserInput } from './contracts/UserManager';

// Import implementation for actual usage
import { createUserService } from './UserManager';

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
