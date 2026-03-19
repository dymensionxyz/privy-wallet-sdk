import { useCallback, useState } from 'react';
import { useSignMessage as useWagmiSignMessage } from 'wagmi';
import type { SigningResult, SigningStatus, SignMessageOptions } from '../types/public';
import { normalizeError } from '../utils/errors';

/**
 * SDK wrapper around wagmi message signing.
 *
 * Provides a consistent status / result / error model that matches the rest
 * of the SDK hooks, so the consumer can use it without importing wagmi directly.
 *
 * Typical use: sign a payload before sending it to a backend for verification.
 */
export function useMessageSigning() {
  const { signMessageAsync } = useWagmiSignMessage();

  const [status, setStatus] = useState<SigningStatus>('idle');
  const [result, setResult] = useState<SigningResult | null>(null);

  const signMessage = useCallback(
    async (message: string, options?: SignMessageOptions): Promise<`0x${string}` | undefined> => {
      const shouldThrow = options?.throwOnError ?? true;
      setResult(null);
      setStatus('pending');
      try {
        const signature = await signMessageAsync({ message });
        setResult({ signature });
        setStatus('success');
        return signature;
      } catch (e) {
        const error = e instanceof Error ? e : new Error(normalizeError(e));
        setResult({ error });
        setStatus('error');
        if (shouldThrow) throw error;
        return undefined;
      }
    },
    [signMessageAsync],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setResult(null);
  }, []);

  return {
    /** Sign a plaintext message. Returns the hex signature, or undefined on failure. */
    signMessage,
    status,
    /** The `0x`-prefixed signature from the last successful call. */
    signature: result?.signature,
    error: result?.error?.message ?? null,
    reset,
  };
}
