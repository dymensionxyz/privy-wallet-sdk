import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PrivyClientConfig } from '@privy-io/react-auth';
import { PrivyProvider } from '@privy-io/react-auth';
import { createConfig, WagmiProvider } from '@privy-io/wagmi';
import { getTransportsFromConfig } from '../config/chains';
import type { WalletSdkConfig } from '../types/public';

const defaultPrivyConfig: PrivyClientConfig = {
  loginMethods: ['email', 'wallet', 'google', 'twitter', 'discord'],
  embeddedWallets: {
    ethereum: { createOnLogin: 'users-without-wallets' },
    showWalletUIs: true,
  },
  appearance: {
    showWalletLoginFirst: false,
  },
};

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
    (): PrivyClientConfig =>
      ({ ...defaultPrivyConfig, ...config.privyConfig } as PrivyClientConfig),
    [config.privyConfig]
  );

  return (
    <PrivyProvider appId={config.appId} config={privyConfig}>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
