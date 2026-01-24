---
"@validkeys/contracted": minor
---

Add full ZodError instance to ValidationError for advanced error handling

ValidationError now includes the complete `zodError` field alongside the existing simplified `errors` array. This enhancement provides full access to Zod's rich error information while maintaining backward compatibility.

**New Features:**
- `ValidationError.data.zodError`: Complete ZodError instance with all Zod methods
- Access to `format()`, `flatten()`, and `formErrors()` methods
- Full details for nested errors, union errors, and refinements
- Backward compatible - existing `errors` array continues to work

**Usage:**
```typescript
if (result.isErr() && result.error._tag === 'VALIDATION_ERROR') {
  // Simplified errors (backward compatible)
  result.error.data.errors.forEach(e => console.log(e.path, e.message));
  
  // Full ZodError with methods
  const formatted = result.error.data.zodError.format();
  const flattened = result.error.data.zodError.flatten();
}
```

**Migration Guide:**
No migration needed - this is a backward compatible addition. Existing code using `result.error.data.errors` continues to work unchanged.
