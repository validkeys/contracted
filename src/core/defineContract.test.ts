import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ok, err } from 'neverthrow';
import { defineCommand } from './defineContract';
import { defineError } from './errors';

describe('defineCommand', () => {
  const UserNotFoundError = defineError<'USER_NOT_FOUND', { userId: string }>(
    'USER_NOT_FOUND',
    'User not found'
  );
  
  const ValidationError = defineError<'VALIDATION_ERROR', { field: string }>(
    'VALIDATION_ERROR',
    'Validation failed'
  );

  const userCommand = defineCommand({
    input: z.object({ userId: z.string() }),
    output: z.object({ id: z.string(), name: z.string(), email: z.string() }),
    dependencies: {} as { userRepo: { findById: (id: string) => Promise<any | null> } },
    errors: [UserNotFoundError, ValidationError] as const
  });

  describe('contract structure', () => {
    it('should create a contract with the correct structure', () => {
      expect(userCommand).toHaveProperty('schemas');
      expect(userCommand).toHaveProperty('types');
      expect(userCommand).toHaveProperty('errors');
      expect(userCommand).toHaveProperty('implementation');
      expect(userCommand).toHaveProperty('unsafeImplementation');
      
      expect(userCommand.schemas.input).toBeDefined();
      expect(userCommand.schemas.output).toBeDefined();
      expect(userCommand.errors).toEqual([UserNotFoundError, ValidationError]);
    });
  });

  describe('implementation method (auto-wrapped)', () => {
    it('should wrap successful return values in ok()', async () => {
      const mockUser = { id: '123', name: 'John Doe', email: 'john@example.com' };
      
      const implementedCommand = userCommand.implementation(async ({ input, deps }) => {
        const user = await deps.userRepo.findById(input.userId);
        if (!user) {
          throw new UserNotFoundError({ userId: input.userId });
        }
        // Return raw output - should be wrapped in ok() automatically
        return user;
      });

      const mockUserRepo = {
        findById: async (id: string) => id === '123' ? mockUser : null
      };

      const result = await implementedCommand.run({
        input: { userId: '123' },
        deps: { userRepo: mockUserRepo }
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual(mockUser);
      }
    });

    it('should catch and wrap thrown TaggedErrors in err()', async () => {
      const implementedCommand = userCommand.implementation(async ({ input, deps }) => {
        const user = await deps.userRepo.findById(input.userId);
        if (!user) {
          // Throw TaggedError - should be caught and wrapped in err()
          throw new UserNotFoundError({ userId: input.userId });
        }
        return user;
      });

      const mockUserRepo = {
        findById: async () => null
      };

      const result = await implementedCommand.run({
        input: { userId: 'nonexistent' },
        deps: { userRepo: mockUserRepo }
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error._tag).toBe('USER_NOT_FOUND');
        expect(result.error.data.userId).toBe('nonexistent');
      }
    });

    it('should re-throw unexpected errors', async () => {
      const implementedCommand = userCommand.implementation(async ({ input, deps }) => {
        throw new Error('Unexpected system error');
      });

      const mockUserRepo = {
        findById: async () => null
      };

      await expect(
        implementedCommand.run({
          input: { userId: '123' },
          deps: { userRepo: mockUserRepo }
        })
      ).rejects.toThrow('Unexpected system error');
    });

    it('should work with withDependencies', async () => {
      const mockUser = { id: '123', name: 'John Doe', email: 'john@example.com' };
      
      const implementedCommand = userCommand.implementation(async ({ input, deps }) => {
        const user = await deps.userRepo.findById(input.userId);
        if (!user) {
          throw new UserNotFoundError({ userId: input.userId });
        }
        return user;
      });

      const mockUserRepo = {
        findById: async (id: string) => id === '123' ? mockUser : null
      };

      const curriedCommand = implementedCommand.withDependencies({ userRepo: mockUserRepo });
      const result = await curriedCommand({ userId: '123' });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual(mockUser);
      }
    });
  });

  describe('unsafeImplementation method (explicit Result handling)', () => {
    it('should work with explicit ok() returns', async () => {
      const mockUser = { id: '123', name: 'John Doe', email: 'john@example.com' };
      
      const implementedCommand = userCommand.unsafeImplementation(async ({ input, deps }) => {
        const user = await deps.userRepo.findById(input.userId);
        if (!user) {
          return err(new UserNotFoundError({ userId: input.userId }));
        }
        // Explicit ok() wrapping required
        return ok(user);
      });

      const mockUserRepo = {
        findById: async (id: string) => id === '123' ? mockUser : null
      };

      const result = await implementedCommand.run({
        input: { userId: '123' },
        deps: { userRepo: mockUserRepo }
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual(mockUser);
      }
    });

    it('should work with explicit err() returns', async () => {
      const implementedCommand = userCommand.unsafeImplementation(async ({ input, deps }) => {
        const user = await deps.userRepo.findById(input.userId);
        if (!user) {
          // Explicit err() wrapping required
          return err(new UserNotFoundError({ userId: input.userId }));
        }
        return ok(user);
      });

      const mockUserRepo = {
        findById: async () => null
      };

      const result = await implementedCommand.run({
        input: { userId: 'nonexistent' },
        deps: { userRepo: mockUserRepo }
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error._tag).toBe('USER_NOT_FOUND');
        expect(result.error.data.userId).toBe('nonexistent');
      }
    });

    it('should work with withDependencies', async () => {
      const mockUser = { id: '123', name: 'John Doe', email: 'john@example.com' };
      
      const implementedCommand = userCommand.unsafeImplementation(async ({ input, deps }) => {
        const user = await deps.userRepo.findById(input.userId);
        if (!user) {
          return err(new UserNotFoundError({ userId: input.userId }));
        }
        return ok(user);
      });

      const mockUserRepo = {
        findById: async (id: string) => id === '123' ? mockUser : null
      };

      const curriedCommand = implementedCommand.withDependencies({ userRepo: mockUserRepo });
      const result = await curriedCommand({ userId: '123' });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual(mockUser);
      }
    });
  });

  describe('validation methods', () => {
    it('should validate input correctly', () => {
      const implementedCommand = userCommand.implementation(async () => {
        return { id: '1', name: 'Test', email: 'test@example.com' };
      });

      expect(() => implementedCommand.validateInput({ userId: 'test123' })).not.toThrow();
      expect(() => implementedCommand.validateInput({ invalid: 'data' })).toThrow();
    });

    it('should validate output correctly', () => {
      const implementedCommand = userCommand.implementation(async () => {
        return { id: '1', name: 'Test', email: 'test@example.com' };
      });

      const validOutput = { id: '1', name: 'Test', email: 'test@example.com' };
      expect(() => implementedCommand.validateOutput(validOutput)).not.toThrow();
      
      const invalidOutput = { id: '1', name: 'Test' }; // missing email
      expect(() => implementedCommand.validateOutput(invalidOutput)).toThrow();
    });
  });

  describe('metadata preservation', () => {
    it('should preserve contract metadata in implemented contracts', () => {
      const implementedCommand = userCommand.implementation(async () => {
        return { id: '1', name: 'Test', email: 'test@example.com' };
      });

      expect(implementedCommand.schemas).toEqual(userCommand.schemas);
      expect(implementedCommand.types).toEqual(userCommand.types);
      expect(implementedCommand.errors).toEqual(userCommand.errors);
    });

    it('should preserve metadata for both implementation methods', () => {
      const safeImpl = userCommand.implementation(async () => {
        return { id: '1', name: 'Test', email: 'test@example.com' };
      });

      const unsafeImpl = userCommand.unsafeImplementation(async () => {
        return ok({ id: '1', name: 'Test', email: 'test@example.com' });
      });

      expect(safeImpl.schemas).toEqual(unsafeImpl.schemas);
      expect(safeImpl.types).toEqual(unsafeImpl.types);
      expect(safeImpl.errors).toEqual(unsafeImpl.errors);
    });
  });
});