import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccount, useConfig } from 'wagmi';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { getBalance } from 'wagmi/actions';
import { useFundWallet } from '@privy-io/react-auth';
import { pad, toHex } from 'viem';
import type { Chain } from 'viem';
import type {
  CasinoVaultConfig,
  VaultDepositResult,
  VaultDepositStatus,
} from '../types/public';
import { normalizeError } from '../utils/errors';
import type { FundAccountOptions } from './useAccountFunding';

// Minimal ABI fragment for ERC-20 approve.
const ERC20_APPROVE_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

// Minimal ABI fragment for CasinoVault.deposit(address,uint256,bytes32).
const CASINO_VAULT_DEPOSIT_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'accountId', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const;

/**
 * Derives the CasinoVault accountId for a given wallet address.
 * Encoding: bytes32(uint256(uint160(addr))) — left-pads the address to 32 bytes.
 */
function deriveAccountId(address: `0x${string}`): `0x${string}` {
  return pad(toHex(BigInt(address)), { size: 32 });
}

export interface UseVaultDepositOptions {
  /** CasinoVault contract address and USDC token address. */
  vault: CasinoVaultConfig;
}

/**
 * CasinoVault USDC deposit hook.
 *
 * Orchestrates two paths:
 *  1. `deposit(amount)` — approve USDC spend then call CasinoVault.deposit directly
 *     from existing wallet funds.
 *  2. `fundAndDeposit(amount, fundingOptions?)` — open Privy funding (MoonPay / on-ramp)
 *     for USDC first, then automatically execute the approve + deposit once the modal closes.
 *
 * `amount` is always in USDC units (6 decimals), e.g. `10_000_000n` = 10 USDC.
 *
 * Status transitions:
 *   deposit path:       idle → approving → depositing → success
 *   fundAndDeposit path: idle → funding → approving → depositing → success
 */
export function useVaultDeposit(options: UseVaultDepositOptions) {
  const { vault } = options;
  const { vaultAddress, tokenAddress } = vault;

  const { address } = useAccount();
  const wagmiConfig = useConfig();
  const [status, setStatus] = useState<VaultDepositStatus>('idle');
  const [result, setResult] = useState<VaultDepositResult | null>(null);

  const pendingDepositAmount = useRef<bigint | undefined>(undefined);
  const awaitingFunding = useRef(false);
  const preFundBalance = useRef<bigint>(0n);

  // Single writeContract handle — reused for both approve and deposit calls.
  const {
    writeContractAsync,
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

  // --- internal: two-step approve → deposit --------------------------------
  const execDeposit = useCallback(
    async (amount: bigint) => {
      if (!address) {
        setStatus('error');
        setResult({ error: new Error('No wallet connected') });
        return;
      }
      if (amount <= 0n) {
        setStatus('error');
        setResult({ error: new Error('Amount must be greater than zero') });
        return;
      }

      const accountId = deriveAccountId(address);

      // Step 1: approve
      setStatus('approving');
      resetWrite?.();
      try {
        await writeContractAsync({
          address: tokenAddress,
          abi: ERC20_APPROVE_ABI,
          functionName: 'approve',
          args: [vaultAddress, amount],
        });
      } catch (e) {
        setStatus('error');
        setResult({ error: e instanceof Error ? e : new Error(normalizeError(e)) });
        return;
      }

      // Step 2: deposit
      setStatus('depositing');
      try {
        await writeContractAsync({
          address: vaultAddress,
          abi: CASINO_VAULT_DEPOSIT_ABI,
          functionName: 'deposit',
          args: [tokenAddress, amount, accountId],
        });
      } catch (e) {
        setStatus('error');
        setResult({ error: e instanceof Error ? e : new Error(normalizeError(e)) });
      }
    },
    [address, vaultAddress, tokenAddress, writeContractAsync, resetWrite],
  );

  // --- funding -------------------------------------------------------------
  const { fundWallet } = useFundWallet({
    onUserExited: async () => {
      if (!awaitingFunding.current) return;
      awaitingFunding.current = false;

      const currentAddress = address;
      if (!currentAddress) {
        setStatus('idle');
        return;
      }
      try {
        const postBal = await getBalance(wagmiConfig, { address: currentAddress });
        if (postBal.value > preFundBalance.current) {
          const amount = pendingDepositAmount.current;
          if (amount !== undefined) {
            execDeposit(amount);
          } else {
            setStatus('idle');
          }
        } else {
          setStatus('idle');
        }
      } catch {
        // If balance check fails, attempt the deposit anyway.
        const amount = pendingDepositAmount.current;
        if (amount !== undefined) {
          execDeposit(amount);
        } else {
          setStatus('idle');
        }
      }
    },
  });

  // --- internal: open Privy funding modal for USDC -------------------------
  const openFunding = useCallback(
    async (targetAddress: `0x${string}`, amount?: bigint, fundingOptions?: FundAccountOptions) => {
      setResult(null);
      setStatus('funding');
      pendingDepositAmount.current = amount;
      awaitingFunding.current = true;

      try {
        const bal = await getBalance(wagmiConfig, { address: targetAddress });
        preFundBalance.current = bal.value;
      } catch {
        preFundBalance.current = 0n;
      }

      const defaultUsdcOptions: FundAccountOptions = { asset: 'USDC' };
      const mergedOptions = fundingOptions ?? defaultUsdcOptions;

      try {
        await fundWallet({
          address: targetAddress,
          options: {
            chain: mergedOptions.chain as Chain | undefined,
            amount: mergedOptions.amount,
            asset: mergedOptions.asset as
              | 'native-currency'
              | 'USDC'
              | { erc20: `0x${string}` }
              | undefined,
            defaultFundingMethod: mergedOptions.defaultFundingMethod,
          },
        });
      } catch (e) {
        awaitingFunding.current = false;
        setStatus('error');
        setResult({ error: e instanceof Error ? e : new Error(normalizeError(e)) });
      }
    },
    [wagmiConfig, fundWallet],
  );

  // --- public: deposit from existing wallet balance ------------------------
  const deposit = useCallback(
    async (amount: bigint) => {
      setResult(null);
      awaitingFunding.current = false;
      await execDeposit(amount);
    },
    [execDeposit],
  );

  // --- public: fund via on-ramp first, then deposit ------------------------
  const fundAndDeposit = useCallback(
    async (amount: bigint, fundingOptions?: FundAccountOptions) => {
      const targetAddress = address;
      if (!targetAddress) {
        setStatus('error');
        setResult({ error: new Error('No wallet connected') });
        return;
      }
      await openFunding(targetAddress, amount, fundingOptions);
    },
    [address, openFunding],
  );

  // --- reset ---------------------------------------------------------------
  const reset = useCallback(() => {
    setStatus('idle');
    setResult(null);
    resetWrite?.();
    awaitingFunding.current = false;
    pendingDepositAmount.current = undefined;
  }, [resetWrite]);

  return {
    /** Approve USDC spend and deposit into CasinoVault from existing wallet balance. */
    deposit,
    /** Open Privy USDC on-ramp first, then approve and deposit once funded. */
    fundAndDeposit,
    /** Current phase of the deposit flow. */
    status: isWritePending
      ? (status === 'approving' ? 'approving' as const : 'depositing' as const)
      : status,
    result,
    error: result?.error?.message ?? writeError?.message ?? null,
    hash: result?.hash ?? hash ?? undefined,
    receipt: result?.receipt,
    reset,
  };
}
