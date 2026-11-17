import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  defineError,
  matchError,
  TaggedError,
  ValidationError,
  zodErrorToValidationError,
} from './errors';

describe('errors', () => {
  // ── Fixtures ──────────────────────────────────────────────────────────────

  const NotFoundError = defineError<'NOT_FOUND', { id: string }>('NOT_FOUND', 'Not found');
  const ForbiddenError = defineError<'FORBIDDEN', { reason: string }>('FORBIDDEN', 'Forbidden');

  // ── defineError ───────────────────────────────────────────────────────────

  describe('defineError', () => {
    it('creates a class with the correct _tag', () => {
      const e = new NotFoundError({ id: '1' });
      expect(e._tag).toBe('NOT_FOUND');
    });

    it('stores typed data on the instance', () => {
      const e = new NotFoundError({ id: 'abc' });
      expect(e.data.id).toBe('abc');
    });

    it('uses the default message when none is supplied', () => {
      const e = new NotFoundError({ id: '1' });
      expect(e.message).toBe('Not found');
    });

    it('uses a custom message when supplied', () => {
      const e = new NotFoundError({ id: '1' }, 'Custom message');
      expect(e.message).toBe('Custom message');
    });

    it('falls back to `Error: <tag>` when neither message nor defaultMessage is provided', () => {
      // Exercises the third leg of: message || defaultMessage || `Error: ${tag}`
      const BareError = defineError<'BARE', {}>('BARE'); // no defaultMessage
      const e = new BareError({});
      expect(e.message).toBe('Error: BARE');
    });

    it('is an instance of Error', () => {
      const e = new NotFoundError({ id: '1' });
      expect(e).toBeInstanceOf(Error);
    });

    it('is an instance of TaggedError', () => {
      const e = new NotFoundError({ id: '1' });
      expect(e).toBeInstanceOf(TaggedError);
    });

    it('sets name to a string', () => {
      const e = new NotFoundError({ id: '1' });
      expect(typeof e.name).toBe('string');
    });

    it('accepts an optional cause', () => {
      const cause = new Error('root cause');
      const e = new NotFoundError({ id: '1' }, undefined, cause);
      expect(e.cause).toBe(cause);
    });
  });

  // ── matchError ────────────────────────────────────────────────────────────

  describe('matchError', () => {
    it('dispatches to the matching handler by _tag', () => {
      const e = new NotFoundError({ id: '42' });

      const result = matchError(e, {
        NOT_FOUND: (err) => `missing: ${err.data.id}`,
        FORBIDDEN: (err) => `forbidden: ${err.data.reason}`,
      });

      expect(result).toBe('missing: 42');
    });

    it('dispatches to the correct handler when the second tag matches', () => {
      const e = new ForbiddenError({ reason: 'no access' });

      const result = matchError(e, {
        NOT_FOUND: () => 'not found',
        FORBIDDEN: (err) => `blocked: ${err.data.reason}`,
      });

      expect(result).toBe('blocked: no access');
    });

    it('throws when no handler matches the error tag', () => {
      // Cast to exercise the defensive `if (!handler)` branch at runtime.
      const e = new NotFoundError({ id: '1' });

      expect(() =>
        matchError(e as any, {
          FORBIDDEN: () => 'forbidden',
        } as any)
      ).toThrow('No handler for error tag: NOT_FOUND');
    });

    it('passes the full typed error instance to the handler', () => {
      const e = new NotFoundError({ id: 'xyz' });
      let captured: typeof e | null = null;

      matchError(e, {
        NOT_FOUND: (err) => {
          captured = err;
          return null;
        },
        FORBIDDEN: () => null,
      });

      expect(captured).toBe(e);
    });
  });

  // ── zodErrorToValidationError ─────────────────────────────────────────────

  describe('zodErrorToValidationError', () => {
    it('converts a ZodError with string paths correctly', () => {
      const schema = z.object({ name: z.string() });
      const result = schema.safeParse({ name: 123 });
      expect(result.success).toBe(false);
      if (!result.success) {
        const ve = zodErrorToValidationError(result.error, 'input');
        expect(ve._tag).toBe('VALIDATION_ERROR');
        expect(ve.data.phase).toBe('input');
        expect(ve.data.errors[0].path).toContain('name');
      }
    });

    it('converts symbol path segments to strings', () => {
      // Exercises: typeof p === 'symbol' ? String(p) : p
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ZodError } = require('zod');
      const sym = Symbol('myKey');
      const zodErr = new ZodError([{
        code: 'custom',
        message: 'bad',
        path: [sym, 'nested'],
      }]);
      const ve = zodErrorToValidationError(zodErr, 'output');
      expect(ve.data.errors[0].path[0]).toBe(String(sym));
      expect(ve.data.errors[0].path[1]).toBe('nested');
      expect(ve.data.phase).toBe('output');
    });
  });

  // ── ValidationError ───────────────────────────────────────────────────────

  describe('ValidationError', () => {
    it('has _tag VALIDATION_ERROR', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ZodError } = require('zod');
      const zodErr = new ZodError([]);
      const e = new ValidationError({ zodError: zodErr, phase: 'input', errors: [], message: 'bad' });
      expect(e._tag).toBe('VALIDATION_ERROR');
    });
  });
});
