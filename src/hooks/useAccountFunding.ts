import { useCallback, useState } from 'react';
import { useFundWallet } from '@privy-io/react-auth';
import { useAccount } from 'wagmi';
import type { Chain } from 'viem';
import type { FundingStatus } from '../types/public';
import { normalizeError } from '../utils/errors';

export interface FundAccountOptions {
  /** Override chain for funding (default from dashboard) */
  chain?: Chain;
  /** Amount as decimal string */
  amount?: string;
  /** 'native-currency' | 'USDC' | { erc20: token address } */
  asset?: 'native-currency' | 'USDC' | { erc20: `0x${string}` };
  /** Skip method selection and open this flow directly */
  defaultFundingMethod?: 'card' | 'exchange' | 'wallet' | 'manual';
}

/**
 * Account funding via Privy's fundWallet modal.
 * - fundAccount(): open funding for the connected wallet (or pass address).
 * - status, error for UI feedback.
 */
export function useAccountFunding() {
  const { address } = useAccount();
  const { fundWallet } = useFundWallet({
    onUserExited() {
      setStatus((s) => (s === 'pending' ? 'success' : s));
    },
  });

  const [status, setStatus] = useState<FundingStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const fundAccount = useCallback(
    async (overrideAddress?: `0x${string}`, options?: FundAccountOptions) => {
      const targetAddress = overrideAddress ?? address;
      if (!targetAddress) {
        const msg = 'No wallet connected and no address provided';
        setError(msg);
        setStatus('error');
        return;
      }
      setError(null);
      setStatus('pending');
      try {
        await fundWallet({
          address: targetAddress,
          ...(options && {
            options: {
              chain: options.chain,
              amount: options.amount,
              asset: options.asset as 'native-currency' | 'USDC' | { erc20: `0x${string}` } | undefined,
              defaultFundingMethod: options.defaultFundingMethod,
            },
          }),
        });
      } catch (e) {
        setError(normalizeError(e));
        setStatus('error');
      }
    },
    [address, fundWallet]
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  return {
    fundAccount,
    status,
    error,
    reset,
  };
}
