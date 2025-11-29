import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { ok, err } from 'neverthrow';
import { expectTypeOf } from 'expect-type';
import { defineService } from './defineService';
import { defineCommand } from './defineContract';
import { defineError } from './errors';

describe('defineService', () => {
  // Setup test contracts
  const UserNotFoundError = defineError<'USER_NOT_FOUND', { userId: string }>(
    'USER_NOT_FOUND',
    'User not found'
  );
  
  const ValidationError = defineError<'VALIDATION_ERROR', { field: string }>(
    'VALIDATION_ERROR',
    'Validation failed'
  );

  const getUserCommand = defineCommand({
    input: z.object({ userId: z.string() }),
    output: z.object({ id: z.string(), name: z.string(), email: z.string() }),
    dependencies: {} as { userRepo: { findById: (id: string) => Promise<any | null> } },
    errors: [UserNotFoundError] as const
  });

  const createUserCommand = defineCommand({
    input: z.object({ name: z.string(), email: z.string().email() }),
    output: z.object({ id: z.string(), name: z.string(), email: z.string() }),
    dependencies: {} as { 
      userRepo: { save: (user: any) => Promise<void> },
      idGenerator: { generate: () => string }
    },
    errors: [ValidationError] as const
  });

  describe('defineService creation', () => {
    it('should create a service contract with the correct structure', () => {
      const serviceContract = defineService({
        getUser: getUserCommand,
        createUser: createUserCommand
      });

      expect(serviceContract).toHaveProperty('contracts');
      expect(serviceContract).toHaveProperty('types');
      expect(serviceContract).toHaveProperty('implementation');
      
      expect(serviceContract.contracts.getUser).toBe(getUserCommand);
      expect(serviceContract.contracts.createUser).toBe(createUserCommand);
    });

    it('should provide type information before implementation', () => {
      const serviceContract = defineService({
        getUser: getUserCommand,
        createUser: createUserCommand
      });

      expect(serviceContract.types).toHaveProperty('Service');
      expect(serviceContract.types).toHaveProperty('Dependencies');
      expect(serviceContract.types).toHaveProperty('Errors');
      expect(serviceContract.types).toHaveProperty('Contracts');
    });
  });

  describe('serviceContract.implementation', () => {
    it('should create a working service from implementations', async () => {
      const serviceContract = defineService({
        getUser: getUserCommand,
        createUser: createUserCommand
      });

      const mockUser = { id: '123', name: 'John Doe', email: 'john@example.com' };
      const mockUserRepo = {
        findById: vi.fn().mockResolvedValue(mockUser),
        save: vi.fn().mockResolvedValue(undefined)
      };
      const mockIdGenerator = {
        generate: vi.fn().mockReturnValue('new-id-123')
      };

      const getUser = getUserCommand.implementation(async ({ input, deps }) => {
        const user = await deps.userRepo.findById(input.userId);
        if (!user) {
          throw new UserNotFoundError({ userId: input.userId });
        }
        return user;
      });

      const createUser = createUserCommand.implementation(async ({ input, deps }) => {
        const user = {
          id: deps.idGenerator.generate(),
          name: input.name,
          email: input.email
        };
        await deps.userRepo.save(user);
        return user;
      });

      const createService = serviceContract.implementation({
        getUser,
        createUser
      });

      const service = createService({
        userRepo: mockUserRepo,
        idGenerator: mockIdGenerator
      });

      // Test getUser
      const getUserResult = await service.getUser.run({ userId: '123' });
      expect(getUserResult.isOk()).toBe(true);
      if (getUserResult.isOk()) {
        expect(getUserResult.value).toEqual(mockUser);
      }
      expect(mockUserRepo.findById).toHaveBeenCalledWith('123');

      // Test createUser
      const createUserResult = await service.createUser.run({ 
        name: 'Jane Doe', 
        email: 'jane@example.com' 
      });
      expect(createUserResult.isOk()).toBe(true);
      if (createUserResult.isOk()) {
        expect(createUserResult.value).toEqual({
          id: 'new-id-123',
          name: 'Jane Doe',
          email: 'jane@example.com'
        });
      }
      expect(mockIdGenerator.generate).toHaveBeenCalled();
      expect(mockUserRepo.save).toHaveBeenCalledWith({
        id: 'new-id-123',
        name: 'Jane Doe',
        email: 'jane@example.com'
      });
    });

    it('should throw error when missing implementations', () => {
      const serviceContract = defineService({
        getUser: getUserCommand,
        createUser: createUserCommand
      });

      expect(() => {
        serviceContract.implementation({
          getUser: getUserCommand.implementation(async () => ({ id: '1', name: 'Test', email: 'test@example.com' }))
          // Missing createUser implementation
        } as any);
      }).toThrow('Missing implementation for contract: createUser');
    });

    it('should handle errors from implementations', async () => {
      const serviceContract = defineService({
        getUser: getUserCommand
      });

      const getUser = getUserCommand.implementation(async ({ input }) => {
        throw new UserNotFoundError({ userId: input.userId });
      });

      const createService = serviceContract.implementation({
        getUser
      });

      const service = createService({
        userRepo: {
          findById: vi.fn().mockResolvedValue(null)
        }
      });

      const result = await service.getUser.run({ userId: 'nonexistent' });
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error._tag).toBe('USER_NOT_FOUND');
        expect(result.error.data.userId).toBe('nonexistent');
      }
    });
  });

  describe('service metadata preservation', () => {
    it('should preserve contract metadata in the service', async () => {
      const serviceContract = defineService({
        getUser: getUserCommand
      });

      const getUser = getUserCommand.implementation(async () => 
        ({ id: '1', name: 'Test', email: 'test@example.com' })
      );

      const createService = serviceContract.implementation({
        getUser
      });

      const service = createService({
        userRepo: { findById: vi.fn() }
      });

      // Check that contract metadata is preserved
      expect(service.getUser).toHaveProperty('schemas');
      expect(service.getUser).toHaveProperty('types');
      expect(service.getUser).toHaveProperty('errors');
      expect(service.getUser).toHaveProperty('validateInput');
      expect(service.getUser).toHaveProperty('validateOutput');
      expect(service.getUser).toHaveProperty('run');

      // Test input validation
      expect(() => service.getUser.validateInput({ userId: 'test' })).not.toThrow();
      expect(() => service.getUser.validateInput({ invalid: 'data' })).toThrow();
      
      // Test output validation
      const validOutput = { id: '1', name: 'Test', email: 'test@example.com' };
      expect(() => service.getUser.validateOutput(validOutput)).not.toThrow();
    });
  });

  describe('implementation methods', () => {
    it('should work with safe implementation method (auto-wrapped)', async () => {
      const serviceContract = defineService({
        getUser: getUserCommand
      });

      const getUser = getUserCommand.implementation(async ({ input, deps }) => {
        const user = await deps.userRepo.findById(input.userId);
        if (!user) {
          throw new UserNotFoundError({ userId: input.userId });
        }
        // Return raw output - automatically wrapped
        return user;
      });

      const createService = serviceContract.implementation({
        getUser
      });

      const mockUser = { id: '123', name: 'John Doe', email: 'john@example.com' };
      const service = createService({
        userRepo: {
          findById: async (id) => id === '123' ? mockUser : null
        }
      });

      const result = await service.getUser.run({ userId: '123' });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual(mockUser);
      }
    });

    it('should work with unsafe implementation method (explicit Result)', async () => {
      const serviceContract = defineService({
        getUser: getUserCommand
      });

      const getUser = getUserCommand.unsafeImplementation(async ({ input, deps }) => {
        const user = await deps.userRepo.findById(input.userId);
        if (!user) {
          return err(new UserNotFoundError({ userId: input.userId }));
        }
        // Explicit Result wrapping required
        return ok(user);
      });

      const createService = serviceContract.implementation({
        getUser
      });

      const mockUser = { id: '123', name: 'John Doe', email: 'john@example.com' };
      const service = createService({
        userRepo: {
          findById: async (id) => id === '123' ? mockUser : null
        }
      });

      const result = await service.getUser.run({ userId: '123' });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual(mockUser);
      }
    });

    it('should handle errors consistently across both methods', async () => {
      const serviceContract = defineService({
        getUser: getUserCommand,
        createUser: createUserCommand
      });

      // Safe implementation throws error
      const getUser = getUserCommand.implementation(async ({ input }) => {
        throw new UserNotFoundError({ userId: input.userId });
      });

      // Unsafe implementation returns err()
      const createUser = createUserCommand.unsafeImplementation(async ({ input }) => {
        return err(new ValidationError({ field: 'email' }));
      });

      const createService = serviceContract.implementation({
        getUser,
        createUser
      });

      const service = createService({
        userRepo: { findById: async () => null, save: async () => {} },
        idGenerator: { generate: () => 'test' }
      });

      const getUserResult = await service.getUser.run({ userId: 'test' });
      expect(getUserResult.isErr()).toBe(true);
      if (getUserResult.isErr()) {
        expect(getUserResult.error._tag).toBe('USER_NOT_FOUND');
      }

      const createUserResult = await service.createUser.run({ 
        name: 'Test', 
        email: 'invalid' 
      });
      expect(createUserResult.isErr()).toBe(true);
      if (createUserResult.isErr()) {
        expect(createUserResult.error._tag).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('type safety and consistency', () => {
    it('should maintain type consistency between contract and service', () => {
      const serviceContract = defineService({
        getUser: getUserCommand,
        createUser: createUserCommand
      });

      const getUser = getUserCommand.implementation(async ({ input, deps }) => {
        const user = await deps.userRepo.findById(input.userId);
        return ok(user || { id: 'default', name: 'Default', email: 'default@example.com' });
      });

      const createUser = createUserCommand.implementation(async ({ input, deps }) => {
        const user = {
          id: deps.idGenerator.generate(),
          name: input.name,
          email: input.email
        };
        await deps.userRepo.save(user);
        return ok(user);
      });

      const createService = serviceContract.implementation({
        getUser,
        createUser
      });

      // TypeScript should enforce that the service matches the contract types
      const service = createService({
        userRepo: {
          findById: async () => null,
          save: async () => {}
        },
        idGenerator: {
          generate: () => 'test-id'
        }
      });

      // These should all be type-safe at compile time
      expect(typeof service.getUser.run).toBe('function');
      expect(typeof service.createUser.run).toBe('function');
    });
  });

  describe('MergeDependencies type correctness (issue #5)', () => {
    it('should require ALL dependencies from all commands (intersection, not union)', () => {
      // Command A requires: db, serviceA, logger
      const commandA = defineCommand({
        input: z.object({ value: z.string() }),
        output: z.object({ result: z.string() }),
        dependencies: {} as { db: Database; serviceA: ServiceA; logger: Logger },
        errors: [] as const
      });

      // Command B requires: db, logger
      const commandB = defineCommand({
        input: z.object({ id: z.string() }),
        output: z.object({ data: z.string() }),
        dependencies: {} as { db: Database; logger: Logger },
        errors: [] as const
      });

      // Command C requires: db, logger, cache
      const commandC = defineCommand({
        input: z.object({ key: z.string() }),
        output: z.object({ value: z.string() }),
        dependencies: {} as { db: Database; logger: Logger; cache: Cache },
        errors: [] as const
      });

      const serviceContract = defineService({
        doA: commandA,
        doB: commandB,
        doC: commandC
      });

      type ServiceDeps = typeof serviceContract.types.Dependencies;

      // Define the types for our dependencies
      type Database = { query: (sql: string) => Promise<any> };
      type Logger = { log: (msg: string) => void };
      type ServiceA = { doSomething: (v: string) => string };
      type Cache = { get: (key: string) => any };

      // Type test: The merged dependencies SHOULD equal the intersection of all deps
      // Expected: { db: Database; serviceA: ServiceA; logger: Logger; cache: Cache }
      expectTypeOf<ServiceDeps>().toEqualTypeOf<{
        db: Database;
        serviceA: ServiceA;
        logger: Logger;
        cache: Cache;
      }>();

      // Direct runtime test: Try to create service with incomplete deps
      // This demonstrates the bug - TypeScript currently allows this but shouldn't
      const doAImpl = commandA.implementation(async ({ input, deps }) => {
        const result = deps.serviceA.doSomething(input.value);
        return { result };
      });

      const doBImpl = commandB.implementation(async ({ input }) => {
        return { data: 'test' };
      });

      const doCImpl = commandC.implementation(async ({ input }) => {
        return { value: 'cached' };
      });

      const createService = serviceContract.implementation({
        doA: doAImpl,
        doB: doBImpl,
        doC: doCImpl
      });

      // BUG DEMONSTRATION: This currently compiles but shouldn't
      // Missing serviceA and cache, but TypeScript allows it because of union type
      // @ts-expect-error - After fix, this line should error (missing serviceA and cache)
      const serviceBuggy = createService({
        db: { query: async () => {} } as Database,
        logger: { log: () => {} } as Logger
        // Missing: serviceA and cache
      });

      // This should be the only valid way to create the service
      const serviceCorrect = createService({
        db: { query: async () => {} } as Database,
        logger: { log: () => {} } as Logger,
        serviceA: { doSomething: (v) => v } as ServiceA,
        cache: { get: () => null } as Cache
      });

      // Verify the correct service works
      expect(typeof serviceCorrect.doA.run).toBe('function');
      expect(typeof serviceCorrect.doB.run).toBe('function');
      expect(typeof serviceCorrect.doC.run).toBe('function');
    });
  });
});