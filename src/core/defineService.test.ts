import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { ok, err } from 'neverthrow';
import { defineService } from './defineService';
import { defineContract } from './defineContract';
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

  const getUserContract = defineContract({
    input: z.object({ userId: z.string() }),
    output: z.object({ id: z.string(), name: z.string(), email: z.string() }),
    dependencies: {} as { userRepo: { findById: (id: string) => Promise<any | null> } },
    errors: [UserNotFoundError] as const
  });

  const createUserContract = defineContract({
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
        getUser: getUserContract,
        createUser: createUserContract
      });

      expect(serviceContract).toHaveProperty('contracts');
      expect(serviceContract).toHaveProperty('types');
      expect(serviceContract).toHaveProperty('implementation');
      
      expect(serviceContract.contracts.getUser).toBe(getUserContract);
      expect(serviceContract.contracts.createUser).toBe(createUserContract);
    });

    it('should provide type information before implementation', () => {
      const serviceContract = defineService({
        getUser: getUserContract,
        createUser: createUserContract
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
        getUser: getUserContract,
        createUser: createUserContract
      });

      const mockUser = { id: '123', name: 'John Doe', email: 'john@example.com' };
      const mockUserRepo = {
        findById: vi.fn().mockResolvedValue(mockUser),
        save: vi.fn().mockResolvedValue(undefined)
      };
      const mockIdGenerator = {
        generate: vi.fn().mockReturnValue('new-id-123')
      };

      const getUser = getUserContract.implementation(async ({ input, deps }) => {
        const user = await deps.userRepo.findById(input.userId);
        if (!user) {
          return err(new UserNotFoundError({ userId: input.userId }));
        }
        return ok(user);
      });

      const createUser = createUserContract.implementation(async ({ input, deps }) => {
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
        getUser: getUserContract,
        createUser: createUserContract
      });

      expect(() => {
        serviceContract.implementation({
          getUser: getUserContract.implementation(async () => ok({ id: '1', name: 'Test', email: 'test@example.com' }))
          // Missing createUser implementation
        } as any);
      }).toThrow('Missing implementation for contract: createUser');
    });

    it('should handle errors from implementations', async () => {
      const serviceContract = defineService({
        getUser: getUserContract
      });

      const getUser = getUserContract.implementation(async ({ input }) => {
        return err(new UserNotFoundError({ userId: input.userId }));
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
        getUser: getUserContract
      });

      const getUser = getUserContract.implementation(async () => 
        ok({ id: '1', name: 'Test', email: 'test@example.com' })
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

  describe('type safety and consistency', () => {
    it('should maintain type consistency between contract and service', () => {
      const serviceContract = defineService({
        getUser: getUserContract,
        createUser: createUserContract
      });

      const getUser = getUserContract.implementation(async ({ input, deps }) => {
        const user = await deps.userRepo.findById(input.userId);
        return ok(user || { id: 'default', name: 'Default', email: 'default@example.com' });
      });

      const createUser = createUserContract.implementation(async ({ input, deps }) => {
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
});