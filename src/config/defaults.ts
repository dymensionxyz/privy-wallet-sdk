import type { Chain } from 'viem';
import type { WalletSdkConfig } from '../types/public';

/**
 * Factory for building a WalletSdkConfig with a single required chain.
 * Avoids the non-empty tuple type assertion that the raw config object requires.
 *
 * @example
 * const config = createWalletSdkConfig({ appId: 'abc', chain: sepolia });
 */
export function createWalletSdkConfig(opts: {
  /** Privy app ID from the dashboard */
  appId: string;
  /** Primary chain */
  chain: Chain;
  /** Additional chains (optional) */
  extraChains?: Chain[];
  /** Custom RPC URLs per chain id */
  rpcUrls?: Partial<Record<number, string>>;
  /** Privy login / appearance overrides */
  privyConfig?: WalletSdkConfig['privyConfig'];
}): WalletSdkConfig {
  return {
    appId: opts.appId,
    chains: [opts.chain, ...(opts.extraChains ?? [])] as [Chain, ...Chain[]],
    rpcUrls: opts.rpcUrls,
    privyConfig: opts.privyConfig,
  };
}
