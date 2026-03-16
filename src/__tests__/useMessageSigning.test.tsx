import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMessageSigning } from '../hooks/useMessageSigning';

const signMessageAsyncMock = vi.fn();

vi.mock('wagmi', () => ({
  useSignMessage: () => ({ signMessageAsync: signMessageAsyncMock }),
}));

describe('useMessageSigning', () => {
  beforeEach(() => {
    signMessageAsyncMock.mockReset();
  });

  it('returns idle state initially', () => {
    const { result } = renderHook(() => useMessageSigning());
    expect(result.current.status).toBe('idle');
    expect(result.current.signature).toBeUndefined();
    expect(result.current.error).toBeNull();
  });

  it('signs a message and returns the signature', async () => {
    const fakeSig = '0xabcdef' as `0x${string}`;
    signMessageAsyncMock.mockResolvedValue(fakeSig);

    const { result } = renderHook(() => useMessageSigning());

    let returned: `0x${string}` | undefined;
    await act(async () => {
      returned = await result.current.signMessage('hello');
    });

    expect(returned).toBe(fakeSig);
    expect(result.current.status).toBe('success');
    expect(result.current.signature).toBe(fakeSig);
    expect(result.current.error).toBeNull();
  });

  it('handles signing failure', async () => {
    signMessageAsyncMock.mockRejectedValue(new Error('user rejected'));

    const { result } = renderHook(() => useMessageSigning());

    let returned: `0x${string}` | undefined;
    await act(async () => {
      returned = await result.current.signMessage('hello');
    });

    expect(returned).toBeUndefined();
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('user rejected');
  });

  it('resets state', async () => {
    signMessageAsyncMock.mockResolvedValue('0xabc');
    const { result } = renderHook(() => useMessageSigning());

    await act(async () => {
      await result.current.signMessage('msg');
    });
    expect(result.current.status).toBe('success');

    act(() => {
      result.current.reset();
    });
    expect(result.current.status).toBe('idle');
    expect(result.current.signature).toBeUndefined();
  });
});
