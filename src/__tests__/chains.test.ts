import { describe, it, expect } from 'vitest';
import { getTransportsFromConfig } from '../config/chains';
import type { WalletSdkConfig } from '../types/public';
import { mainnet, sepolia } from 'viem/chains';

describe('getTransportsFromConfig', () => {
  it('builds transports for each chain with default http', () => {
    const config: WalletSdkConfig = {
      appId: 'test',
      chains: [sepolia, mainnet],
    };
    const t = getTransportsFromConfig(config);
    expect(t[sepolia.id]).toBeDefined();
    expect(t[mainnet.id]).toBeDefined();
  });

  it('uses custom RPC URL when provided', () => {
    const config: WalletSdkConfig = {
      appId: 'test',
      chains: [sepolia],
      rpcUrls: { [sepolia.id]: 'https://custom.rpc.io' },
    };
    const t = getTransportsFromConfig(config);
    expect(t[sepolia.id]).toBeDefined();
  });
});
