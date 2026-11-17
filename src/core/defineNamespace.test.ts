import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { ok, err } from 'neverthrow';
import { expectTypeOf } from 'expect-type';
import { defineNamespace, NAMESPACE_TAG, Namespace } from './defineNamespace';
import { defineCommand } from './defineContract';
import { defineService } from './defineService';
import { serviceFrom, serviceFromSimple, MergeDependencies } from './serviceFrom';
import { defineError } from './errors';

describe('defineNamespace', () => {
  // ============================================================================
  // FIXTURES
  // ============================================================================

  const UserNotFoundError = defineError<'USER_NOT_FOUND', { userId: string }>(
    'USER_NOT_FOUND',
    'User not found'
  );

  const PostNotFoundError = defineError<'POST_NOT_FOUND', { postId: string }>(
    'POST_NOT_FOUND',
    'Post not found'
  );

  // User contracts / implementations
  const createUserContract = defineCommand({
    input: z.object({ name: z.string(), email: z.string().email() }),
    output: z.object({ id: z.string(), name: z.string(), email: z.string() }),
    dependencies: {} as { userRepo: { save: (u: any) => Promise<void>; generate: () => string } },
    errors: [UserNotFoundError] as const,
  });

  const getUserContract = defineCommand({
    input: z.object({ userId: z.string() }),
    output: z.object({ id: z.string(), name: z.string(), email: z.string() }),
    dependencies: {} as { userRepo: { findById: (id: string) => Promise<any | null> } },
    errors: [UserNotFoundError] as const,
  });

  // Health contract (flat, no deps)
  const healthContract = defineCommand({
    input: z.object({}),
    output: z.object({ status: z.string() }),
    dependencies: {} as Record<string, never>,
    errors: [] as const,
  });

  // Reusable mock repos
  const mockUserRepo = {
    save: vi.fn().mockResolvedValue(undefined),
    generate: vi.fn().mockReturnValue('generated-id'),
    findById: vi.fn().mockResolvedValue({ id: '1', name: 'Alice', email: 'alice@example.com' }),
  };

  // ============================================================================
  // STANDALONE METADATA TESTS
  // ============================================================================

  describe('standalone metadata', () => {
    it('returns an object with contracts, types, and NAMESPACE_TAG properties', () => {
      const ns = defineNamespace({ create: createUserContract });

      expect(ns).toHaveProperty('contracts');
      expect(ns).toHaveProperty('types');
      expect(NAMESPACE_TAG in ns).toBe(true);
    });

    it('contracts property holds the original contracts', () => {
      const ns = defineNamespace({ create: createUserContract });
      expect(ns.contracts.create).toBe(createUserContract);
    });

    it('NAMESPACE_TAG is true on the namespace object', () => {
      const ns = defineNamespace({ create: createUserContract });
      expect(ns[NAMESPACE_TAG]).toBe(true);
    });

    it('types object has Dependencies, Errors, and Contracts keys', () => {
      const ns = defineNamespace({ create: createUserContract });
      expect(ns.types).toHaveProperty('Dependencies');
      expect(ns.types).toHaveProperty('Errors');
      expect(ns.types).toHaveProperty('Contracts');
    });

    it('defineNamespace({}) returns valid namespace with empty contracts', () => {
      const ns = defineNamespace({} as Record<string, never>);
      expect(ns.contracts).toEqual({});
      expect(NAMESPACE_TAG in ns).toBe(true);
    });

    it('accepts multiple contracts in the same namespace', () => {
      const ns = defineNamespace({ create: createUserContract, get: getUserContract });
      expect(ns.contracts.create).toBe(createUserContract);
      expect(ns.contracts.get).toBe(getUserContract);
    });
  });

  // ============================================================================
  // ONE-LEVEL-DEEP ENFORCEMENT
  // ============================================================================

  describe('one-level-deep enforcement', () => {
    it('throws when a value is itself a Namespace (runtime guard)', () => {
      const inner = defineNamespace({ create: createUserContract });
      expect(() =>
        defineNamespace({ sub: inner as any })
      ).toThrow('defineNamespace: nested namespaces are not supported. Key "sub" is itself a Namespace.');
    });

    it('error message includes the offending key name', () => {
      const inner = defineNamespace({ get: getUserContract });
      expect(() =>
        defineNamespace({ users: inner as any })
      ).toThrow('Key "users" is itself a Namespace');
    });
  });

  // ============================================================================
  // serviceFrom WITH NAMESPACE
  // ============================================================================

  describe('serviceFrom with namespace', () => {
    const createUserImpl = createUserContract.implementation(async ({ input, deps }) => ({
      id: deps.userRepo.generate(),
      name: input.name,
      email: input.email,
    }));

    const getUserImpl = getUserContract.implementation(async ({ input, deps }) => {
      const user = await deps.userRepo.findById(input.userId);
      if (!user) throw new UserNotFoundError({ userId: input.userId });
      return user;
    });

    const usersNamespace = defineNamespace({ create: createUserImpl, get: getUserImpl });

    const createService = serviceFrom({ users: usersNamespace });

    it('service.users.create.run(input) resolves correctly', async () => {
      const service = createService({ userRepo: mockUserRepo });
      const result = await service.users.create.run({ name: 'Bob', email: 'bob@example.com' });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.name).toBe('Bob');
        expect(result.value.id).toBe('generated-id');
      }
    });

    it('service.users.create.schemas.input is defined', () => {
      const service = createService({ userRepo: mockUserRepo });
      expect(service.users.create.schemas).toBeDefined();
      expect(service.users.create.schemas.input).toBeDefined();
    });

    it('service.users.create.errors is defined', () => {
      const service = createService({ userRepo: mockUserRepo });
      expect(service.users.create.errors).toBeDefined();
      expect(Array.isArray(service.users.create.errors)).toBe(true);
    });

    it('service.users.create.validateInput is a function', () => {
      const service = createService({ userRepo: mockUserRepo });
      expect(typeof service.users.create.validateInput).toBe('function');
    });

    it('service.users.create.validateOutput is a function', () => {
      const service = createService({ userRepo: mockUserRepo });
      expect(typeof service.users.create.validateOutput).toBe('function');
    });

    it('service.users.get.run(input) resolves correctly', async () => {
      const service = createService({ userRepo: mockUserRepo });
      const result = await service.users.get.run({ userId: '1' });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.id).toBe('1');
        expect(result.value.name).toBe('Alice');
      }
    });
  });

  // ============================================================================
  // serviceFrom WITH MIXED (flat + namespace)
  // ============================================================================

  describe('serviceFrom with mixed flat and namespace', () => {
    const healthImpl = healthContract.implementation(async () => ({ status: 'ok' }));

    const createUserImpl = createUserContract.implementation(async ({ input, deps }) => ({
      id: deps.userRepo.generate(),
      name: input.name,
      email: input.email,
    }));

    const usersNamespace = defineNamespace({ create: createUserImpl });

    const createMixedService = serviceFrom({
      health: healthImpl,
      users: usersNamespace,
    });

    it('flat command (health.run) succeeds in the same instance', async () => {
      const service = createMixedService({ userRepo: mockUserRepo });
      const result = await service.health.run({});
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.status).toBe('ok');
      }
    });

    it('namespace command (users.create.run) succeeds in the same mixed instance', async () => {
      const service = createMixedService({ userRepo: mockUserRepo });
      const result = await service.users.create.run({ name: 'Carol', email: 'carol@example.com' });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.name).toBe('Carol');
      }
    });
  });

  // ============================================================================
  // serviceFromSimple WITH NAMESPACE
  // ============================================================================

  describe('serviceFromSimple with namespace', () => {
    const createUserImpl = createUserContract.implementation(async ({ input, deps }) => ({
      id: deps.userRepo.generate(),
      name: input.name,
      email: input.email,
    }));

    const usersNamespace = defineNamespace({ create: createUserImpl });

    const createSimpleService = serviceFromSimple({ users: usersNamespace });

    it('service.users.create(input) resolves correctly (curried, no .run)', async () => {
      const service = createSimpleService({ userRepo: mockUserRepo });
      const result = await service.users.create({ name: 'Dave', email: 'dave@example.com' });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.name).toBe('Dave');
        expect(result.value.id).toBe('generated-id');
      }
    });

    it('namespace commands are plain curried functions (no .run, .schemas, etc.)', () => {
      const service = createSimpleService({ userRepo: mockUserRepo });
      expect(typeof service.users.create).toBe('function');
      // serviceFromSimple does NOT attach schemas/errors metadata
      expect((service.users.create as any).schemas).toBeUndefined();
    });
  });

  // ============================================================================
  // defineService WITH NAMESPACE
  // ============================================================================

  describe('defineService with namespace', () => {
    const createUserImpl = createUserContract.implementation(async ({ input, deps }) => ({
      id: deps.userRepo.generate(),
      name: input.name,
      email: input.email,
    }));

    const usersImplNamespace = defineNamespace({ create: createUserImpl });

    it('defineService with namespace creates valid contract object', () => {
      const usersNamespace = defineNamespace({ create: createUserContract });
      const appContract = defineService({ users: usersNamespace });
      expect(appContract).toHaveProperty('contracts');
      expect(appContract).toHaveProperty('types');
      expect(appContract).toHaveProperty('implementation');
    });

    it('appContract.implementation with namespace wires correctly', async () => {
      const usersNamespace = defineNamespace({ create: createUserContract });
      const appContract = defineService({ users: usersNamespace });

      const createAppService = appContract.implementation({
        users: usersImplNamespace,
      });

      const service = createAppService({ userRepo: mockUserRepo });
      const result = await service.users.create.run({ name: 'Eve', email: 'eve@example.com' });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.name).toBe('Eve');
      }
    });

    it('service.users.create.run(input) resolves from defineService path', async () => {
      const usersNamespace = defineNamespace({ create: createUserContract });
      const appContract = defineService({ users: usersNamespace });

      const createAppService = appContract.implementation({
        users: usersImplNamespace,
      });

      const service = createAppService({ userRepo: mockUserRepo });
      const result = await service.users.create.run({ name: 'Frank', email: 'frank@example.com' });
      expect(result.isOk()).toBe(true);
    });

    it('throws when namespace implementation is missing a sub-command', () => {
      const usersNamespace = defineNamespace({ create: createUserContract, get: getUserContract });
      const appContract = defineService({ users: usersNamespace });

      expect(() => {
        appContract.implementation({
          users: defineNamespace({ create: createUserImpl }) as any,
        });
      }).toThrow('Missing implementation for contract: users.get');
    });

    it('throws when a namespace key has no implementation at all', () => {
      const usersNamespace = defineNamespace({ create: createUserContract });
      const appContract = defineService({ users: usersNamespace });

      expect(() => {
        appContract.implementation({} as any);
      }).toThrow('Missing implementation for contract: users');
    });
  });

  // ============================================================================
  // DEPENDENCY MERGE TESTS
  // ============================================================================

  describe('dependency merging', () => {
    it('serviceFrom requires ALL deps from ALL commands (flat + namespaced)', () => {
      const createUserImpl = createUserContract.implementation(async ({ input, deps }) => ({
        id: deps.userRepo.generate(),
        name: input.name,
        email: input.email,
      }));
      const healthImpl = healthContract.implementation(async () => ({ status: 'ok' }));

      const usersNamespace = defineNamespace({ create: createUserImpl });

      const createService = serviceFrom({
        health: healthImpl,
        users: usersNamespace,
      });

      // Should require userRepo from the namespaced command
      const service = createService({ userRepo: mockUserRepo });
      expect(typeof service.users.create.run).toBe('function');
    });

    it('validateInput on a namespace command works correctly', () => {
      const createUserImpl = createUserContract.implementation(async ({ input, deps }) => ({
        id: deps.userRepo.generate(),
        name: input.name,
        email: input.email,
      }));
      const usersNamespace = defineNamespace({ create: createUserImpl });
      const createService = serviceFrom({ users: usersNamespace });
      const service = createService({ userRepo: mockUserRepo });

      // Valid input should not throw
      expect(() => service.users.create.validateInput({ name: 'Test', email: 'test@example.com' })).not.toThrow();
      // Invalid input should throw (Zod parse)
      expect(() => service.users.create.validateInput({ name: 123 })).toThrow();
    });

    it('namespace command run returns ValidationError on bad input', async () => {
      const createUserImpl = createUserContract.implementation(async ({ input, deps }) => ({
        id: deps.userRepo.generate(),
        name: input.name,
        email: input.email,
      }));
      const usersNamespace = defineNamespace({ create: createUserImpl });
      const createService = serviceFrom({ users: usersNamespace });
      const service = createService({ userRepo: mockUserRepo });

      const result = await service.users.create.run({ name: 'Test', email: 'not-an-email' } as any);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error._tag).toBe('VALIDATION_ERROR');
      }
    });
  });

  // ============================================================================
  // TYPE-LEVEL ASSERTIONS
  // ============================================================================

  describe('type safety (expectTypeOf)', () => {
    it('MergeDependencies with namespace equals intersection of all deps', () => {
      const createUserImpl = createUserContract.implementation(async ({ input, deps }) => ({
        id: deps.userRepo.generate(),
        name: input.name,
        email: input.email,
      }));

      const usersNamespace = defineNamespace({ create: createUserImpl });
      const healthImpl = healthContract.implementation(async () => ({ status: 'ok' }));

      type Entries = {
        health: typeof healthImpl;
        users: typeof usersNamespace;
      };

      type Deps = MergeDependencies<Entries>;

      // userRepo is required from the namespaced command
      expectTypeOf<Deps>().toMatchTypeOf<{
        userRepo: { save: (u: any) => Promise<void>; generate: () => string };
      }>();
    });

    it('service.users.create.run is typed as a function', () => {
      const createUserImpl = createUserContract.implementation(async ({ input, deps }) => ({
        id: deps.userRepo.generate(),
        name: input.name,
        email: input.email,
      }));

      const usersNamespace = defineNamespace({ create: createUserImpl });
      const createService = serviceFrom({ users: usersNamespace });
      const service = createService({ userRepo: mockUserRepo });

      expectTypeOf(service.users.create.run).toBeFunction();
    });

    it('serviceFromSimple namespace commands are curried functions', () => {
      const createUserImpl = createUserContract.implementation(async ({ input, deps }) => ({
        id: deps.userRepo.generate(),
        name: input.name,
        email: input.email,
      }));

      const usersNamespace = defineNamespace({ create: createUserImpl });
      const createSimpleService = serviceFromSimple({ users: usersNamespace });
      const service = createSimpleService({ userRepo: mockUserRepo });

      expectTypeOf(service.users.create).toBeFunction();
    });

    it('namespace types.Dependencies resolves correctly for ImplementedContracts', () => {
      const createUserImpl = createUserContract.implementation(async ({ input, deps }) => ({
        id: deps.userRepo.generate(),
        name: input.name,
        email: input.email,
      }));

      const getUserImpl = getUserContract.implementation(async ({ input, deps }) => {
        const user = await deps.userRepo.findById(input.userId);
        if (!user) throw new UserNotFoundError({ userId: input.userId });
        return user;
      });

      const ns = defineNamespace({ create: createUserImpl, get: getUserImpl });

      // Both types.Dependencies and types.Errors exist
      expectTypeOf(ns.types).toHaveProperty('Dependencies');
      expectTypeOf(ns.types).toHaveProperty('Errors');
      expectTypeOf(ns.types).toHaveProperty('Contracts');
    });
  });

  // ============================================================================
  // REGRESSION — existing flat services unchanged
  // ============================================================================

  describe('regression — flat services unchanged', () => {
    it('serviceFrom with flat commands still works', async () => {
      const createUserImpl = createUserContract.implementation(async ({ input, deps }) => ({
        id: deps.userRepo.generate(),
        name: input.name,
        email: input.email,
      }));

      const createService = serviceFrom({ createUser: createUserImpl });
      const service = createService({ userRepo: mockUserRepo });

      const result = await service.createUser.run({ name: 'Grace', email: 'grace@example.com' });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.name).toBe('Grace');
      }
    });

    it('serviceFromSimple with flat commands still works', async () => {
      const createUserImpl = createUserContract.implementation(async ({ input, deps }) => ({
        id: deps.userRepo.generate(),
        name: input.name,
        email: input.email,
      }));

      const createService = serviceFromSimple({ createUser: createUserImpl });
      const service = createService({ userRepo: mockUserRepo });

      const result = await service.createUser({ name: 'Henry', email: 'henry@example.com' });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.name).toBe('Henry');
      }
    });

    it('defineService with flat commands still works', async () => {
      const appContract = defineService({ createUser: createUserContract });
      const createUserImpl = createUserContract.implementation(async ({ input, deps }) => ({
        id: deps.userRepo.generate(),
        name: input.name,
        email: input.email,
      }));

      const createAppService = appContract.implementation({ createUser: createUserImpl });
      const service = createAppService({ userRepo: mockUserRepo });

      const result = await service.createUser.run({ name: 'Iris', email: 'iris@example.com' });
      expect(result.isOk()).toBe(true);
    });
  });
});

// ==============================================================================
// END-TO-END INTEGRATION (issue #7)
// ==============================================================================

describe('end-to-end integration (issue #7)', () => {
  // ── Errors ──────────────────────────────────────────────────────────────────
  const UserNotFoundError = defineError<'USER_NOT_FOUND', { userId: string }>(
    'USER_NOT_FOUND', 'User not found'
  );
  const PostNotFoundError = defineError<'POST_NOT_FOUND', { postId: string }>(
    'POST_NOT_FOUND', 'Post not found'
  );

  // ── User contracts ───────────────────────────────────────────────────────────
  const createUserContract = defineCommand({
    input: z.object({ name: z.string(), email: z.string().email() }),
    output: z.object({ id: z.string(), name: z.string() }),
    dependencies: {} as { userRepo: { save: (u: any) => Promise<void>; generate: () => string } },
    errors: [UserNotFoundError] as const,
  });

  const getUserContract = defineCommand({
    input: z.object({ userId: z.string() }),
    output: z.object({ id: z.string(), name: z.string() }),
    dependencies: {} as { userRepo: { findById: (id: string) => Promise<any | null> } },
    errors: [UserNotFoundError] as const,
  });

  // ── Post contracts ───────────────────────────────────────────────────────────
  const createPostContract = defineCommand({
    input: z.object({ title: z.string(), authorId: z.string() }),
    output: z.object({ id: z.string(), title: z.string(), authorId: z.string(), published: z.boolean() }),
    dependencies: {} as { postRepo: { save: (p: any) => Promise<void>; generate: () => string } },
    errors: [PostNotFoundError] as const,
  });

  const publishPostContract = defineCommand({
    input: z.object({ postId: z.string() }),
    output: z.object({ id: z.string(), title: z.string(), authorId: z.string(), published: z.boolean() }),
    dependencies: {} as { postRepo: { findById: (id: string) => Promise<any | null>; update: (p: any) => Promise<void> } },
    errors: [PostNotFoundError] as const,
  });

  // ── Health contract (flat) ───────────────────────────────────────────────────
  const healthContract = defineCommand({
    input: z.object({}),
    output: z.object({ status: z.string() }),
    dependencies: {} as Record<string, never>,
    errors: [] as const,
  });

  // ── Implementations ──────────────────────────────────────────────────────────
  const createUserImpl = createUserContract.implementation(async ({ input, deps }) => ({
    id: deps.userRepo.generate(),
    name: input.name,
  }));

  const getUserImpl = getUserContract.implementation(async ({ input, deps }) => {
    const user = await deps.userRepo.findById(input.userId);
    if (!user) throw new UserNotFoundError({ userId: input.userId });
    return user;
  });

  const createPostImpl = createPostContract.implementation(async ({ input, deps }) => ({
    id: deps.postRepo.generate(),
    title: input.title,
    authorId: input.authorId,
    published: false,
  }));

  const publishPostImpl = publishPostContract.implementation(async ({ input, deps }) => {
    const post = await deps.postRepo.findById(input.postId);
    if (!post) throw new PostNotFoundError({ postId: input.postId });
    const published = { ...post, published: true };
    await deps.postRepo.update(published);
    return published;
  });

  const healthImpl = healthContract.implementation(async () => ({ status: 'ok' }));

  // ── Mock repos ───────────────────────────────────────────────────────────────
  const mockUser = { id: 'u-1', name: 'Alice' };
  const mockPost = { id: 'p-1', title: 'Hello', authorId: 'u-1', published: false };

  const mockUserRepo = {
    save: vi.fn().mockResolvedValue(undefined),
    generate: vi.fn().mockReturnValue('u-new'),
    findById: vi.fn().mockResolvedValue(mockUser),
  };
  const mockPostRepo = {
    save: vi.fn().mockResolvedValue(undefined),
    generate: vi.fn().mockReturnValue('p-new'),
    findById: vi.fn().mockResolvedValue(mockPost),
    update: vi.fn().mockResolvedValue(undefined),
  };

  // ============================================================================
  // PATH 1: defineService with users + posts namespaces
  // ============================================================================

  describe('PATH 1: defineService with multiple namespaces', () => {
    const appContract = defineService({
      users: defineNamespace({ create: createUserContract, get: getUserContract }),
      posts: defineNamespace({ create: createPostContract, publish: publishPostContract }),
    });

    const createAppService = appContract.implementation({
      users: defineNamespace({ create: createUserImpl, get: getUserImpl }),
      posts: defineNamespace({ create: createPostImpl, publish: publishPostImpl }),
    });

    it('service.users.create.run(input) succeeds', async () => {
      const service = createAppService({ userRepo: mockUserRepo, postRepo: mockPostRepo });
      const result = await service.users.create.run({ name: 'Bob', email: 'bob@example.com' });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.name).toBe('Bob');
        expect(result.value.id).toBe('u-new');
      }
    });

    it('service.posts.publish.run(input) succeeds', async () => {
      const service = createAppService({ userRepo: mockUserRepo, postRepo: mockPostRepo });
      const result = await service.posts.publish.run({ postId: 'p-1' });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.published).toBe(true);
      }
    });

    it('service.users.create.schemas.input is defined', () => {
      const service = createAppService({ userRepo: mockUserRepo, postRepo: mockPostRepo });
      expect(service.users.create.schemas).toBeDefined();
      expect(service.users.create.schemas.input).toBeDefined();
    });

    it('service.users.get.run(input) resolves correctly', async () => {
      const service = createAppService({ userRepo: mockUserRepo, postRepo: mockPostRepo });
      const result = await service.users.get.run({ userId: 'u-1' });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.name).toBe('Alice');
      }
    });

    it('service.posts.create.run(input) succeeds', async () => {
      const service = createAppService({ userRepo: mockUserRepo, postRepo: mockPostRepo });
      const result = await service.posts.create.run({ title: 'My Post', authorId: 'u-1' });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.title).toBe('My Post');
        expect(result.value.published).toBe(false);
      }
    });

    it('dep injection: missing deps is a TypeScript error (type-only assertion)', () => {
      // @ts-expect-error — TypeScript enforces that all deps (userRepo + postRepo) are provided.
      // If this line stops being a TS error the test file will fail to compile,
      // which is the intended signal. No runtime assertion needed.
      createAppService({ userRepo: mockUserRepo });
    });
  });

  // ============================================================================
  // PATH 2: serviceFrom with one flat command + one namespace
  // ============================================================================

  describe('PATH 2: serviceFrom mixed (flat + namespace)', () => {
    const createMixedService = serviceFrom({
      health: healthImpl,
      users: defineNamespace({ create: createUserImpl }),
    });

    it('service.health.run({}) succeeds (flat command)', async () => {
      const service = createMixedService({ userRepo: mockUserRepo });
      const result = await service.health.run({});
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.status).toBe('ok');
      }
    });

    it('service.users.create.run(input) succeeds in same mixed instance', async () => {
      const service = createMixedService({ userRepo: mockUserRepo });
      const result = await service.users.create.run({ name: 'Mixed', email: 'mixed@example.com' });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.name).toBe('Mixed');
      }
    });

    it('dep injection: missing deps is a TypeScript error (type-only assertion)', () => {
      // @ts-expect-error — TypeScript enforces that userRepo is provided.
      // If this line stops being a TS error the test file will fail to compile,
      // which is the intended signal. No runtime assertion needed.
      createMixedService({});
    });
  });

  // ============================================================================
  // PATH 3: serviceFromSimple with namespaces
  // ============================================================================

  describe('PATH 3: serviceFromSimple with namespace', () => {
    const createSimpleService = serviceFromSimple({
      users: defineNamespace({ create: createUserImpl }),
    });

    it('service.users.create(input) resolves (no .run)', async () => {
      const service = createSimpleService({ userRepo: mockUserRepo });
      const result = await service.users.create({ name: 'Simple', email: 'simple@example.com' });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.name).toBe('Simple');
      }
    });

    it('namespace commands are plain functions (not .run wrappers)', () => {
      const service = createSimpleService({ userRepo: mockUserRepo });
      expect(typeof service.users.create).toBe('function');
    });

    it('dep injection: missing deps is a TypeScript error (type-only assertion)', () => {
      // @ts-expect-error — TypeScript enforces that userRepo is provided.
      // If this line stops being a TS error the test file will fail to compile,
      // which is the intended signal. No runtime assertion needed.
      createSimpleService({});
    });
  });
});
