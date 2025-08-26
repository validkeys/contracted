import { describe, it, expect, vi } from 'vitest';
import { createUserService } from './packages/UserManager/index';
import type { UserManagerService, UserManagerDependencies } from './packages/contracts/UserManager/service';

describe('Example Integration Test', () => {
  it('should demonstrate the defineService pattern working end-to-end', async () => {
    // Mock dependencies
    const mockDeps: UserManagerDependencies = {
      userRepository: {
        save: vi.fn().mockResolvedValue(undefined),
        findByEmail: vi.fn().mockResolvedValue(null),
        findById: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
      },
      idGenerator: {
        generate: vi.fn().mockReturnValue('test-user-123'),
      },
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
    };

    // Create service using the new defineService pattern
    const userService: UserManagerService = createUserService(mockDeps);

    // Test creating a user
    const result = await userService.createUser.run({
      email: 'test@example.com',
      name: 'Test User',
      age: 25,
    });

    expect(result.isOk()).toBe(true);
    
    if (result.isOk()) {
      expect(result.value).toEqual({
        id: 'test-user-123',
        email: 'test@example.com',
        name: 'Test User',
        age: 25,
        createdAt: expect.any(Date),
      });
    }

    // Verify mocks were called correctly
    expect(mockDeps.idGenerator.generate).toHaveBeenCalled();
    expect(mockDeps.userRepository.save).toHaveBeenCalledWith({
      id: 'test-user-123',
      email: 'test@example.com',
      name: 'Test User',
      age: 25,
      createdAt: expect.any(Date),
    });
    expect(mockDeps.logger.info).toHaveBeenCalledWith(
      'Creating user', 
      { email: 'test@example.com' }
    );
  });

  it('should handle validation errors', async () => {
    const mockDeps: UserManagerDependencies = {
      userRepository: {
        save: vi.fn(),
        findByEmail: vi.fn().mockResolvedValue(null),
        findById: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      idGenerator: {
        generate: vi.fn().mockReturnValue('test-user-123'),
      },
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
    };

    const userService = createUserService(mockDeps);

    // Test with invalid name (contains @ symbol)
    const result = await userService.createUser.run({
      email: 'test@example.com',
      name: 'Test@User', // Invalid name with @ symbol
      age: 25,
    });

    expect(result.isErr()).toBe(true);
    
    if (result.isErr()) {
      expect(result.error._tag).toBe('INVALID_USER_DATA');
      expect(result.error.data).toEqual({
        field: 'name',
        reason: 'Name cannot contain @ symbol'
      });
    }
  });

  it('should demonstrate type safety across package boundaries', () => {
    // This function simulates how another package would use the service
    function useUserService(service: UserManagerService) {
      return {
        async createNewUser(name: string, email: string, age: number) {
          return service.createUser.run({ name, email, age });
        }
      };
    }

    const mockDeps: UserManagerDependencies = {
      userRepository: {
        save: vi.fn(),
        findByEmail: vi.fn(),
        findById: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      idGenerator: {
        generate: vi.fn(),
      },
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
    };

    const userService = createUserService(mockDeps);
    const userHandler = useUserService(userService);

    // TypeScript ensures the service interface matches expectations
    expect(typeof userHandler.createNewUser).toBe('function');
    expect(typeof userService.createUser.run).toBe('function');
    expect(typeof userService.createUser.validateInput).toBe('function');
    expect(typeof userService.createUser.validateOutput).toBe('function');
  });
});