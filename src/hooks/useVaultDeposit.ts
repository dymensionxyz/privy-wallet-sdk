import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccount } from 'wagmi';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useFundWallet } from '@privy-io/react-auth';
import type { Chain } from 'viem';
import type {
  VaultContractConfig,
  VaultDepositResult,
  VaultDepositStatus,
} from '../types/public';
import { normalizeError } from '../utils/errors';
import type { FundAccountOptions } from './useAccountFunding';

export interface UseVaultDepositOptions {
  /** Full contract config: address, ABI, function name, and optional static args. */
  contract: VaultContractConfig;
}

/**
 * High-level vault deposit hook.
 *
 * Orchestrates two paths:
 *  1. `deposit(value?)` — call the vault contract directly from existing wallet funds.
 *  2. `fundAndDeposit(value?, fundingOptions?)` — open Privy funding (MoonPay / on-ramp),
 *     then automatically call the vault contract once the funding modal closes.
 *
 * Both paths share a single status / result model so the consumer only needs one
 * piece of UI to track progress.
 */
export function useVaultDeposit(options: UseVaultDepositOptions) {
  const { contract } = options;

  const { address } = useAccount();
  const [status, setStatus] = useState<VaultDepositStatus>('idle');
  const [result, setResult] = useState<VaultDepositResult | null>(null);

  // Track whether we should auto-deposit after funding completes.
  const pendingDepositValue = useRef<bigint | undefined>(undefined);
  const awaitingFunding = useRef(false);

  // --- contract write -------------------------------------------------
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
        error: writeError instanceof Error ? writeError : new Error(normalizeError(writeError)),
      });
    }
  }, [writeError]);

  useEffect(() => {
    if (hash) setResult((prev) => ({ ...prev, hash }));
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

  // --- internal: execute the contract call ----------------------------
  const execDeposit = useCallback(
    async (valueWei?: bigint) => {
      setStatus('depositing');
      resetWrite?.();
      try {
        await writeContract({
          address: contract.address,
          abi: contract.abi,
          functionName: contract.functionName,
          args: contract.args as unknown[] | undefined,
          ...(valueWei !== undefined && valueWei !== null && { value: valueWei }),
        });
      } catch (e) {
        setStatus('error');
        setResult({ error: e instanceof Error ? e : new Error(normalizeError(e)) });
      }
    },
    [contract, writeContract, resetWrite],
  );

  // --- funding --------------------------------------------------------
  const { fundWallet } = useFundWallet({
    onUserExited() {
      if (awaitingFunding.current) {
        awaitingFunding.current = false;
        execDeposit(pendingDepositValue.current);
      }
    },
  });

  // --- public: deposit directly from wallet ---------------------------
  const deposit = useCallback(
    async (valueWei?: bigint) => {
      setResult(null);
      awaitingFunding.current = false;
      await execDeposit(valueWei);
    },
    [execDeposit],
  );

  // --- public: fund first, then deposit -------------------------------
  const fundAndDeposit = useCallback(
    async (valueWei?: bigint, fundingOptions?: FundAccountOptions) => {
      const targetAddress = address;
      if (!targetAddress) {
        setStatus('error');
        setResult({ error: new Error('No wallet connected') });
        return;
      }

      setResult(null);
      setStatus('funding');
      pendingDepositValue.current = valueWei;
      awaitingFunding.current = true;

      try {
        await fundWallet({
          address: targetAddress,
          ...(fundingOptions && {
            options: {
              chain: fundingOptions.chain as Chain | undefined,
              amount: fundingOptions.amount,
              asset: fundingOptions.asset as
                | 'native-currency'
                | 'USDC'
                | { erc20: `0x${string}` }
                | undefined,
              defaultFundingMethod: fundingOptions.defaultFundingMethod,
            },
          }),
        });
      } catch (e) {
        awaitingFunding.current = false;
        setStatus('error');
        setResult({ error: e instanceof Error ? e : new Error(normalizeError(e)) });
      }
    },
    [address, fundWallet],
  );

  // --- reset ----------------------------------------------------------
  const reset = useCallback(() => {
    setStatus('idle');
    setResult(null);
    resetWrite?.();
    awaitingFunding.current = false;
    pendingDepositValue.current = undefined;
  }, [resetWrite]);

  return {
    /** Deposit directly from existing wallet balance. */
    deposit,
    /** Open Privy funding first, then deposit once the modal closes. */
    fundAndDeposit,
    /** Current phase of the vault deposit flow. */
    status: isWritePending ? 'depositing' as const : status,
    result,
    error: result?.error?.message ?? writeError?.message ?? null,
    hash: result?.hash ?? hash ?? undefined,
    receipt: result?.receipt,
    reset,
  };
}
