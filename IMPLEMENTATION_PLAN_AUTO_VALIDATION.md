# Implementation Plan: Automatic Input/Output Validation

## Overview

Add automatic schema validation for inputs and outputs in the `implementation()` method before calling user implementations. This ensures type safety at runtime and aligns the actual behavior with the documented "automatic validation" feature.

**Version:** 4.0.0 (Breaking Change)
**Approach:** Test-Driven Development (TDD)

## Current State

- `defineCommand` creates contracts with input/output Zod schemas
- `validateInput()` and `validateOutput()` utility methods exist but must be called manually
- Documentation claims "automatic validation" but implementation doesn't validate automatically
- The `run()` method passes input directly to implementations without validation

**Files affected:**
- `src/core/defineContract.ts:246-277` - `implementation()` method
- `src/core/defineContract.ts:80-83` - `ImplementedContract` interface
- `src/core/types.ts` - Type definitions
- `src/core/errors.ts` - New validation error type

## Design Decisions (Based on User Input)

### 1. Validation Failure Behavior
**Decision:** Return `err()` with ZodError wrapped in the Result type

**Rationale:**
- Consistent with neverthrow pattern
- Allows type-safe error handling
- Validation errors become part of the contract's error union

### 2. Output Validation
**Decision:** Also validate outputs automatically

**Rationale:**
- Catches implementation bugs early
- Ensures contract compliance
- Provides runtime type safety guarantees

### 3. Method Coverage
**Decision:** Only apply to `implementation()`, skip `unsafeImplementation()`

**Rationale:**
- `unsafeImplementation()` is for users who want full control
- Keeps advanced escape hatch available
- Clear separation: safe (validated) vs unsafe (manual)

### 4. Breaking Change Strategy
**Decision:** Breaking change in v4.0.0

**Rationale:**
- Aligns behavior with documentation
- Removes inconsistency
- Clear version boundary for migration

## Error Type Design

Create a new `ValidationError` tagged error type:

```typescript
export const ValidationError = defineError<
  'VALIDATION_ERROR',
  {
    phase: 'input' | 'output';
    errors: z.ZodError['errors'];
    message: string;
  }
>('VALIDATION_ERROR', 'Schema validation failed');
```

**Key properties:**
- `phase`: Whether input or output validation failed
- `errors`: Raw Zod error details for debugging
- `message`: Human-readable error summary

**Note:** This error will be automatically added to all contracts, similar to how other system-level errors work.

## TDD Test Plan

### Phase 1: Write Failing Tests (Red)

#### Test Suite 1: Input Validation Tests
**File:** `src/core/defineContract.test.ts`

1. **Test:** `should validate input before calling implementation`
   - Given: Command with strict input schema (e.g., email, min length)
   - When: Call `run()` with invalid input
   - Then: Return `err()` with `VALIDATION_ERROR` containing Zod details
   - Assert: Implementation function is never called

2. **Test:** `should pass validated input to implementation when valid`
   - Given: Command with input schema
   - When: Call `run()` with valid input
   - Then: Implementation receives the validated, parsed input
   - Assert: Zod transformations are applied (e.g., string trim, coercion)

3. **Test:** `should include detailed Zod errors in validation failure`
   - Given: Command with multiple validation rules
   - When: Call `run()` with multiple validation failures
   - Then: Error includes all Zod error details (field paths, messages)
   - Assert: phase === 'input'

#### Test Suite 2: Output Validation Tests
**File:** `src/core/defineContract.test.ts`

4. **Test:** `should validate output after implementation succeeds`
   - Given: Command with strict output schema
   - When: Implementation returns invalid output
   - Then: Return `err()` with `VALIDATION_ERROR` (phase: 'output')
   - Assert: Implementation was called but output rejected

5. **Test:** `should pass valid output through successfully`
   - Given: Command with output schema
   - When: Implementation returns valid output
   - Then: Return `ok()` with validated output
   - Assert: Zod transformations are applied to output

6. **Test:** `should validate output even when implementation throws TaggedError`
   - Given: Command with output schema
   - When: Implementation throws a business error (e.g., UserNotFoundError)
   - Then: Return `err()` with the business error (no output validation)
   - Assert: Output validation skipped for error paths

#### Test Suite 3: Method Coverage Tests
**File:** `src/core/defineContract.test.ts`

7. **Test:** `unsafeImplementation() should NOT validate input`
   - Given: Command with strict input schema
   - When: Call `unsafeImplementation()` with invalid input
   - Then: Implementation receives raw invalid input
   - Assert: No validation error thrown

8. **Test:** `unsafeImplementation() should NOT validate output`
   - Given: Command with strict output schema
   - When: `unsafeImplementation()` returns invalid output
   - Then: Invalid output passes through
   - Assert: No validation error

#### Test Suite 4: Service Integration Tests
**File:** `src/core/defineService.test.ts`

9. **Test:** `service commands should validate inputs`
   - Given: Service with command using `implementation()`
   - When: Call service command with invalid input
   - Then: Return validation error
   - Assert: Service-level behavior consistent with command-level

10. **Test:** `service commands should validate outputs`
    - Given: Service with command returning invalid output
    - When: Implementation returns malformed data
    - Then: Return output validation error

#### Test Suite 5: Type Safety Tests
**File:** `src/core/defineContract.test.ts`

11. **Test:** `ValidationError should be in error union type`
    - Given: Command with defined errors [UserNotFoundError]
    - When: Check types.Error type
    - Then: Type includes ValidationError | UserNotFoundError
    - Assert: TypeScript compilation with exhaustive matching

12. **Test:** `validateInput() method should still work`
    - Given: Implemented command
    - When: Call `validateInput()` manually
    - Then: Still validates and throws ZodError on failure
    - Assert: Backward compatibility for manual validation

#### Test Suite 6: Edge Cases
**File:** `src/core/defineContract.test.ts`

13. **Test:** `should handle async validation errors`
    - Given: Command with async Zod refinements
    - When: Async validation fails
    - Then: Return validation error after async check

14. **Test:** `should preserve Zod transformations`
    - Given: Schema with `.transform()` or `.default()`
    - When: Run with valid input
    - Then: Transformed values passed to implementation

15. **Test:** `should handle nested object validation`
    - Given: Schema with nested objects and arrays
    - When: Nested field is invalid
    - Then: Error includes full path (e.g., "user.address.zipCode")

### Phase 2: Implement (Green)

After writing all failing tests, implement the feature to make tests pass.

### Phase 3: Refactor (Refactor)

Clean up implementation while keeping tests green.

## Implementation Steps

### Step 1: Create ValidationError Type
**File:** `src/core/errors.ts`

```typescript
/**
 * System-level error thrown when input or output validation fails
 */
export const ValidationError = defineError<
  'VALIDATION_ERROR',
  {
    phase: 'input' | 'output';
    errors: Array<{
      path: (string | number)[];
      message: string;
      code: string;
    }>;
    message: string;
  }
>('VALIDATION_ERROR', 'Schema validation failed');

// Helper to convert ZodError to ValidationError
export function zodErrorToValidationError(
  zodError: z.ZodError,
  phase: 'input' | 'output'
): InstanceType<typeof ValidationError> {
  return new ValidationError({
    phase,
    errors: zodError.errors.map(e => ({
      path: e.path,
      message: e.message,
      code: e.code,
    })),
    message: `${phase} validation failed: ${zodError.errors.map(e => e.message).join(', ')}`,
  });
}
```

### Step 2: Update ImplementedContract Interface
**File:** `src/core/defineContract.ts:36-84`

Update the `TErrors` type to always include `ValidationError`:

```typescript
export interface ImplementedContract<
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
  TDeps extends Record<string, any>,
  TOptions extends Record<string, any> = Record<string, never>,
  TErrors extends ReadonlyArray<new (...args: any[]) => TaggedError> = []
> {
  schemas: {
    input: TInput;
    output: TOutput;
  };
  types: {
    Input: InferSchema<TInput>;
    Output: InferSchema<TOutput>;
    Dependencies: TDeps;
    Options: TOptions;
    // ValidationError is automatically included in all contracts
    Error: ErrorUnion<[...TErrors, typeof ValidationError]>;
    Implementation: ImplementationFunction<
      InferSchema<TInput>,
      InferSchema<TOutput>,
      TDeps,
      TOptions,
      ErrorUnion<[...TErrors, typeof ValidationError]>
    >;
  };
  errors: [...TErrors, typeof ValidationError]; // Include ValidationError
  run: ImplementationFunction<
    InferSchema<TInput>,
    InferSchema<TOutput>,
    TDeps,
    TOptions,
    ErrorUnion<[...TErrors, typeof ValidationError]>
  >;
  // ... rest of interface
}
```

### Step 3: Implement Validated Wrapper in implementation()
**File:** `src/core/defineContract.ts:246-277`

```typescript
implementation: (impl) => {
  const wrappedImpl: ImplementationFunction<
    InferSchema<TInput>,
    InferSchema<TOutput>,
    TDeps,
    TOptions,
    ErrorUnion<[...TErrors, typeof ValidationError]>
  > = async (context) => {
    // STEP 1: Validate input before calling implementation
    const inputValidation = params.input.safeParse(context.input);
    if (!inputValidation.success) {
      return err(zodErrorToValidationError(inputValidation.error, 'input'));
    }

    // Use validated and transformed input
    const validatedContext = {
      ...context,
      input: inputValidation.data,
    };

    try {
      // STEP 2: Call implementation with validated input
      const result = await impl(validatedContext);

      // STEP 3: Validate output before returning success
      const outputValidation = params.output.safeParse(result);
      if (!outputValidation.success) {
        return err(zodErrorToValidationError(outputValidation.error, 'output'));
      }

      return ok(outputValidation.data);
    } catch (error) {
      // If it's already a TaggedError, return it as an error
      if (error && typeof error === 'object' && '_tag' in error) {
        return err(error as ErrorUnion<[...TErrors, typeof ValidationError]>);
      }
      // Otherwise, re-throw as this is an unexpected error
      throw error;
    }
  };

  const implementedContract: ImplementedContract<TInput, TOutput, TDeps, TOptions, [...TErrors, typeof ValidationError]> = {
    ...contract,
    errors: [...errors, ValidationError] as [...TErrors, typeof ValidationError],
    run: wrappedImpl,
    withDependencies: (deps: TDeps) => {
      return (input, options) => wrappedImpl({ input, deps, options });
    },
    validateInput: (input: unknown) => params.input.parse(input),
    validateOutput: (output: unknown) => params.output.parse(output),
  };
  return implementedContract;
},
```

### Step 4: Keep unsafeImplementation() Unchanged
**File:** `src/core/defineContract.ts:279-290`

- No changes to `unsafeImplementation()`
- Users who want manual validation control use this method
- Document this as the "escape hatch" for full control

### Step 5: Update Contract Interface
**File:** `src/core/defineContract.ts:111-159`

Update the `Contract` interface to reflect that implementations will include ValidationError:

```typescript
export interface Contract<
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
  TDeps extends Record<string, any>,
  TOptions extends Record<string, any> = Record<string, never>,
  TErrors extends ReadonlyArray<new (...args: any[]) => TaggedError> = []
> {
  // ... existing fields ...

  /** Method to add an implementation to this contract (automatically wraps in neverthrow with validation) */
  implementation: (
    impl: UnsafeImplementationFunction<
      InferSchema<TInput>,
      InferSchema<TOutput>,
      TDeps,
      TOptions
    >
  ) => ImplementedContract<TInput, TOutput, TDeps, TOptions, [...TErrors, typeof ValidationError]>;

  /** Method to add an unsafe implementation that requires explicit Result handling (no automatic validation) */
  unsafeImplementation: (
    impl: ImplementationFunction<
      InferSchema<TInput>,
      InferSchema<TOutput>,
      TDeps,
      TOptions,
      ErrorUnion<TErrors>
    >
  ) => ImplementedContract<TInput, TOutput, TDeps, TOptions, TErrors>; // No ValidationError added
}
```

### Step 6: Update Service Layer
**Files:** `src/core/defineService.ts`, `src/core/serviceFrom.ts`

- Ensure services properly propagate ValidationError type
- Update type definitions to include ValidationError in merged error unions
- Test that service-level composition handles validation errors

## Migration Guide

### For Users (v4.0.0 Breaking Changes)

#### What Changed

The `implementation()` method now automatically validates inputs and outputs using the defined Zod schemas. Validation failures return `err()` with a `VALIDATION_ERROR` instead of passing invalid data to your implementation.

#### Before (v3.x)

```typescript
const getUser = getUserCommand.implementation(async ({ input, deps }) => {
  // input could be invalid - no validation happened
  const user = await deps.userRepo.findById(input.userId);
  if (!user) {
    throw new UserNotFoundError({ userId: input.userId });
  }
  return user; // output could be invalid - no validation
});

// Users had to manually validate
try {
  const validInput = getUserCommand.validateInput(req.body);
  const result = await getUser.run({ input: validInput, deps });
} catch (e) {
  // Handle validation error
}
```

#### After (v4.0.0)

```typescript
const getUser = getUserCommand.implementation(async ({ input, deps }) => {
  // input is guaranteed valid and transformed by Zod
  const user = await deps.userRepo.findById(input.userId);
  if (!user) {
    throw new UserNotFoundError({ userId: input.userId });
  }
  return user; // output will be validated before returning
});

// Validation happens automatically
const result = await getUser.run({ input: req.body, deps });

if (result.isErr()) {
  switch (result.error._tag) {
    case 'VALIDATION_ERROR':
      // Handle validation failure
      console.error(`Validation failed in ${result.error.data.phase}:`, result.error.data.errors);
      break;
    case 'USER_NOT_FOUND':
      // Handle business error
      break;
  }
}
```

#### Breaking Changes

1. **ValidationError in Error Union**
   - All contracts using `implementation()` now include `VALIDATION_ERROR` in their error union
   - Update exhaustive error matching to handle `VALIDATION_ERROR`

2. **Input Types**
   - Implementations now receive Zod-transformed inputs (e.g., trimmed strings, coerced numbers)
   - If you relied on raw input, switch to `unsafeImplementation()`

3. **Output Validation**
   - Implementations must return valid output matching the output schema
   - Invalid outputs return `VALIDATION_ERROR` instead of passing through

#### Migration Options

**Option 1: Embrace automatic validation (Recommended)**
- Update error handling to include `VALIDATION_ERROR` cases
- Remove manual `validateInput()` calls
- Fix implementations that return invalid outputs

**Option 2: Use unsafeImplementation() for full control**
- Replace `.implementation()` with `.unsafeImplementation()`
- Keep manual validation if needed
- No automatic validation, same behavior as v3.x

```typescript
// No automatic validation
const getUser = getUserCommand.unsafeImplementation(async ({ input, deps }) => {
  // Manually validate if you want
  const validInput = getUserCommand.validateInput(input);

  const user = await deps.userRepo.findById(validInput.userId);
  if (!user) {
    return err(new UserNotFoundError({ userId: input.userId }));
  }
  return ok(user);
});
```

## Documentation Updates

### Files to Update

1. **README.md**
   - Update "Implementation Methods" section (lines 365-440)
   - Add ValidationError to error handling examples (lines 500-550)
   - Update "Benefits" section - change "Automatic validation" to explicitly mention it happens automatically

2. **CHANGELOG.md**
   - Add v4.0.0 breaking change entry
   - Document new behavior
   - Link to migration guide

3. **src/core/defineContract.ts**
   - Update JSDoc comments on `implementation()` method
   - Document ValidationError auto-inclusion
   - Add examples showing validation errors

4. **API Reference in README**
   - Update `defineCommand` return type documentation
   - Add `ValidationError` to error types section
   - Document difference between `implementation()` and `unsafeImplementation()`

## Testing Strategy

### Test Coverage Requirements

- Unit tests: 100% coverage of validation logic
- Integration tests: Full service validation flow
- Type tests: TypeScript compilation with ValidationError
- Error tests: All validation failure scenarios
- Edge cases: Async validation, transformations, nested schemas

### Test Execution Order (TDD)

1. Write all 15 failing tests first
2. Run test suite - confirm all tests fail as expected
3. Implement Step 1 (ValidationError) - some tests may pass
4. Implement Step 2 (Interface updates) - type tests pass
5. Implement Step 3 (Validation logic) - remaining tests pass
6. Run full test suite - all tests green
7. Refactor if needed while keeping tests green

## Rollback Plan

If critical issues found after release:

1. **Quick fix:** Add `skipValidation: boolean` flag to `defineCommand`
2. **Hotfix release:** v4.0.1 with opt-out capability
3. **Full rollback:** Revert to v3.x behavior in v4.1.0 if needed

## Success Criteria

- [ ] All 15 TDD tests pass
- [ ] No regression in existing tests
- [ ] Type safety maintained (TypeScript compiles)
- [ ] Documentation fully updated
- [ ] Migration guide complete
- [ ] Example code updated
- [ ] CHANGELOG entry written
- [ ] 100% test coverage for new validation logic

## Timeline Estimate

- Phase 1 (Write tests): 2-3 hours
- Phase 2 (Implementation): 3-4 hours
- Phase 3 (Refactor): 1 hour
- Documentation: 2 hours
- Testing & validation: 1-2 hours

**Total: 9-12 hours**

## Questions Resolved

1. ✅ Validation failure behavior: Return err() with ZodError wrapped
2. ✅ Output validation: Yes, validate automatically
3. ✅ Method coverage: Only implementation(), skip unsafeImplementation()
4. ✅ Breaking change: v4.0.0 with clear migration guide
