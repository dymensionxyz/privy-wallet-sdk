import { describe, it, expect } from 'vitest';
import { normalizeError, WalletSdkError } from '../utils/errors';

describe('normalizeError', () => {
  it('returns message for Error', () => {
    expect(normalizeError(new Error('foo'))).toBe('foo');
  });

  it('returns string as-is', () => {
    expect(normalizeError('bar')).toBe('bar');
  });

  it('returns message from object with message', () => {
    expect(normalizeError({ message: 'baz' })).toBe('baz');
  });

  it('returns default for unknown', () => {
    expect(normalizeError(null)).toBe('An unknown error occurred');
  });
});

describe('WalletSdkError', () => {
  it('sets name and message', () => {
    const e = new WalletSdkError('test', 'ERR_CODE');
    expect(e.name).toBe('WalletSdkError');
    expect(e.message).toBe('test');
    expect(e.code).toBe('ERR_CODE');
  });
});
