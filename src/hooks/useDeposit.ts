import { useCallback, useEffect, useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import type { DepositResult, DepositStatus } from '../types/public';
import { normalizeError } from '../utils/errors';

/** Stubbed ABI for deposit() - no args, no return. Adjust when contract is final. */
const DEPOSIT_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
] as const;

export interface UseDepositOptions {
  /** Contract address that implements deposit() */
  contractAddress: `0x${string}`;
}

/**
 * Deposit funds into the configured contract via deposit().
 * - deposit(valueWei?): send tx; optional value for payable deposit.
 * - status, result, error for UI and receipt.
 */
export function useDeposit(options: UseDepositOptions) {
  const { contractAddress } = options;

  const [status, setStatus] = useState<DepositStatus>('idle');
  const [result, setResult] = useState<DepositResult | null>(null);

  const {
    writeContract,
    data: hash,
    isPending: isWritePending,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  const { data: receipt } = useWaitForTransactionReceipt({
    hash: hash ?? undefined,
  });

  useEffect(() => {
    if (writeError) {
      setStatus('error');
      setResult({
        error:
          writeError instanceof Error ? writeError : new Error(normalizeError(writeError)),
      });
    }
  }, [writeError]);

  useEffect(() => {
    if (hash) {
      setResult((prev) => ({ ...prev, hash }));
    }
  }, [hash]);

  useEffect(() => {
    if (receipt && hash) {
      setResult((prev) => ({
        ...prev,
        hash,
        receipt: {
          status: receipt.status === 'success' ? 'success' : 'reverted',
          blockNumber: receipt.blockNumber,
        },
      }));
      setStatus('success');
    }
  }, [receipt, hash]);

  const deposit = useCallback(
    async (valueWei?: bigint) => {
      setResult(null);
      setStatus('pending');
      resetWrite?.();
      try {
        await writeContract({
          address: contractAddress,
          abi: DEPOSIT_ABI,
          functionName: 'deposit',
          ...(valueWei !== undefined && valueWei !== null && { value: valueWei }),
        });
      } catch (e) {
        setStatus('error');
        setResult({ error: e instanceof Error ? e : new Error(normalizeError(e)) });
      }
    },
    [contractAddress, writeContract, resetWrite]
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setResult(null);
    resetWrite?.();
  }, [resetWrite]);

  return {
    deposit,
    status: isWritePending ? 'pending' : status,
    result,
    error: result?.error?.message ?? writeError?.message ?? null,
    hash: result?.hash ?? hash ?? undefined,
    receipt: result?.receipt,
    reset,
  };
}
