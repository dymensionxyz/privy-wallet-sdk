import type { Chain } from 'viem';
import { http } from 'wagmi';
import type { WalletSdkConfig } from '../types/public';

/** Default chains if consumer does not provide (e.g. Sepolia for testing) */
export const defaultChains: Chain[] = [];

/** Build wagmi transports from config (uses http() with optional custom RPC) */
export function getTransportsFromConfig(config: WalletSdkConfig) {
  const transports: Record<number, ReturnType<typeof http>> = {};
  for (const chain of config.chains) {
    const url = config.rpcUrls?.[chain.id];
    transports[chain.id] = url ? http(url) : http();
  }
  return transports;
}
