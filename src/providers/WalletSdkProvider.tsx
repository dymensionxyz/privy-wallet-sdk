import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PrivyClientConfig } from '@privy-io/react-auth';
import { PrivyProvider } from '@privy-io/react-auth';
import { createConfig, WagmiProvider } from '@privy-io/wagmi';
import { getTransportsFromConfig } from '../config/chains';
import type { WalletSdkConfig } from '../types/public';

const SDK_EMBEDDED_WALLETS = {
  ethereum: { createOnLogin: 'all-users' as const },
  showWalletUIs: false,
};

const defaultPrivyConfig: PrivyClientConfig = {
  loginMethods: ['email', 'wallet', 'google', 'twitter', 'discord'],
  embeddedWallets: SDK_EMBEDDED_WALLETS,
  appearance: {
    showWalletLoginFirst: false,
  },
};

/**
 * Deep-merge consumer privyConfig on top of SDK defaults.
 * Guarantees embedded-wallet auto-creation is preserved unless the consumer
 * explicitly overrides `embeddedWallets.ethereum.createOnLogin`.
 */
function mergePrivyConfig(consumer?: Partial<PrivyClientConfig>): PrivyClientConfig {
  if (!consumer) return defaultPrivyConfig;

  const mergedEmbeddedWallets = {
    ...SDK_EMBEDDED_WALLETS,
    ...consumer.embeddedWallets,
    ethereum: {
      ...SDK_EMBEDDED_WALLETS.ethereum,
      ...consumer.embeddedWallets?.ethereum,
    },
  };

  return {
    ...defaultPrivyConfig,
    ...consumer,
    embeddedWallets: mergedEmbeddedWallets,
  } as PrivyClientConfig;
}

export interface WalletSdkProviderProps {
  config: WalletSdkConfig;
  children: ReactNode;
}

/** Composed provider: Privy → QueryClient → Wagmi. Wrap your app with this to use SDK hooks. */
export function WalletSdkProvider({ config, children }: WalletSdkProviderProps) {
  const queryClient = useMemo(() => new QueryClient(), []);

  const wagmiConfig = useMemo(() => {
    return createConfig({
      chains: config.chains,
      transports: getTransportsFromConfig(config),
    });
  }, [config.chains, config.rpcUrls]);

  const privyConfig = useMemo(
    () => mergePrivyConfig(config.privyConfig as Partial<PrivyClientConfig> | undefined),
    [config.privyConfig],
  );

  return (
    <PrivyProvider appId={config.appId} config={privyConfig}>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
