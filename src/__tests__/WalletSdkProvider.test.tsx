import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WalletSdkProvider } from '../providers/WalletSdkProvider';
import { sepolia } from 'viem/chains';

let capturedPrivyConfig: Record<string, unknown> | undefined;

vi.mock('@privy-io/react-auth', () => ({
  PrivyProvider: ({ children, config }: { children: React.ReactNode; config?: Record<string, unknown> }) => {
    capturedPrivyConfig = config;
    return <div data-testid="privy">{children}</div>;
  },
}));

vi.mock('@tanstack/react-query', () => ({
  QueryClient: vi.fn(() => ({})),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="query">{children}</div>
  ),
}));

vi.mock('@privy-io/wagmi', () => ({
  createConfig: vi.fn(() => ({ chains: [sepolia] })),
  WagmiProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="wagmi">{children}</div>
  ),
}));

describe('WalletSdkProvider', () => {
  it('renders Privy > Query > Wagmi and children', () => {
    render(
      <WalletSdkProvider
        config={{ appId: 'test-app', chains: [sepolia] }}
      >
        <span>Child</span>
      </WalletSdkProvider>
    );
    expect(screen.getByTestId('privy')).toBeInTheDocument();
    expect(screen.getByTestId('query')).toBeInTheDocument();
    expect(screen.getByTestId('wagmi')).toBeInTheDocument();
    expect(screen.getByText('Child')).toBeInTheDocument();
  });

  it('preserves embedded-wallet auto-creation when consumer overrides appearance', () => {
    render(
      <WalletSdkProvider
        config={{
          appId: 'test-app',
          chains: [sepolia],
          privyConfig: { appearance: { theme: 'dark' } },
        }}
      >
        <span>Child</span>
      </WalletSdkProvider>
    );

    const embedded = capturedPrivyConfig?.embeddedWallets as Record<string, unknown> | undefined;
    expect(embedded).toBeDefined();
    // Consumer only overrides appearance; SDK default 'all-users' must be preserved.
    expect((embedded?.ethereum as Record<string, unknown>)?.createOnLogin).toBe(
      'all-users',
    );
  });

  it('allows consumer to explicitly override createOnLogin', () => {
    render(
      <WalletSdkProvider
        config={{
          appId: 'test-app',
          chains: [sepolia],
          privyConfig: {
            embeddedWallets: { ethereum: { createOnLogin: 'all-users' } },
          },
        }}
      >
        <span>Child</span>
      </WalletSdkProvider>
    );

    const embedded = capturedPrivyConfig?.embeddedWallets as Record<string, unknown> | undefined;
    expect((embedded?.ethereum as Record<string, unknown>)?.createOnLogin).toBe('all-users');
  });
});
