import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccount, useConfig } from 'wagmi';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { getBalance } from 'wagmi/actions';
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
  /**
   * Full contract config: address, ABI, function name, and optional static args.
   * When omitted (phase 1), deposit actions only fund the user's embedded wallet
   * without any on-chain contract call. Supply this to activate vault deposit (phase 2).
   */
  contract?: VaultContractConfig;
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
export function useVaultDeposit(options?: UseVaultDepositOptions) {
  const { contract } = options ?? {};

  const { address } = useAccount();
  const wagmiConfig = useConfig();
  const [status, setStatus] = useState<VaultDepositStatus>('idle');
  const [result, setResult] = useState<VaultDepositResult | null>(null);

  // Track whether we should auto-deposit after funding completes.
  const pendingDepositValue = useRef<bigint | undefined>(undefined);
  const awaitingFunding = useRef(false);
  const preFundBalance = useRef<bigint>(0n);

  // --- contract write (only used when contract is provided) -----------
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

  // --- internal: execute the vault contract call (phase 2 only) ------
  const execDeposit = useCallback(
    async (valueWei?: bigint) => {
      if (!contract) return;
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
    onUserExited: async () => {
      if (!awaitingFunding.current) return;
      awaitingFunding.current = false;

      // Only proceed if the balance actually increased, which distinguishes
      // a completed funding from a dismissed modal.
      const currentAddress = address;
      if (!currentAddress) {
        setStatus('idle');
        return;
      }
      try {
        const postBal = await getBalance(wagmiConfig, { address: currentAddress });
        if (postBal.value > preFundBalance.current) {
          if (contract) {
            // Phase 2: fund then call vault contract.
            execDeposit(pendingDepositValue.current);
          } else {
            // Phase 1: wallet is funded — that's all we need.
            setStatus('success');
            setResult({});
          }
        } else {
          setStatus('idle');
        }
      } catch {
        if (contract) {
          // If balance check fails with a vault, fall back to attempting the deposit.
          execDeposit(pendingDepositValue.current);
        } else {
          setStatus('idle');
        }
      }
    },
  });

  // --- internal: shared funding modal logic ---------------------------
  const openFunding = useCallback(
    async (targetAddress: `0x${string}`, valueWei?: bigint, fundingOptions?: FundAccountOptions) => {
      setResult(null);
      setStatus('funding');
      pendingDepositValue.current = valueWei;
      awaitingFunding.current = true;

      try {
        const bal = await getBalance(wagmiConfig, { address: targetAddress });
        preFundBalance.current = bal.value;
      } catch {
        preFundBalance.current = 0n;
      }

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
    [wagmiConfig, fundWallet],
  );

  // --- public: deposit / fund account ---------------------------------
  const deposit = useCallback(
    async (valueWei?: bigint, fundingOptions?: FundAccountOptions) => {
      if (contract) {
        // Phase 2: call the vault contract directly from the existing wallet balance.
        setResult(null);
        awaitingFunding.current = false;
        await execDeposit(valueWei);
      } else {
        // Phase 1: no vault — just open the funding modal.
        const targetAddress = address;
        if (!targetAddress) {
          setStatus('error');
          setResult({ error: new Error('No wallet connected') });
          return;
        }
        await openFunding(targetAddress, valueWei, fundingOptions);
      }
    },
    [contract, address, execDeposit, openFunding],
  );

  // --- public: fund first, then deposit (or just fund in phase 1) ----
  const fundAndDeposit = useCallback(
    async (valueWei?: bigint, fundingOptions?: FundAccountOptions) => {
      const targetAddress = address;
      if (!targetAddress) {
        setStatus('error');
        setResult({ error: new Error('No wallet connected') });
        return;
      }
      await openFunding(targetAddress, valueWei, fundingOptions);
    },
    [address, openFunding],
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
    /**
     * Phase 1 (no contract): opens Privy funding modal to top up the wallet.
     * Phase 2 (contract provided): calls the vault contract directly from existing balance.
     */
    deposit,
    /**
     * Opens Privy funding modal first. In phase 1 succeeds once balance increases.
     * In phase 2 also calls the vault contract afterward.
     */
    fundAndDeposit,
    /** Current phase of the deposit flow. */
    status: isWritePending ? 'depositing' as const : status,
    result,
    error: result?.error?.message ?? writeError?.message ?? null,
    hash: result?.hash ?? hash ?? undefined,
    receipt: result?.receipt,
    reset,
  };
}
