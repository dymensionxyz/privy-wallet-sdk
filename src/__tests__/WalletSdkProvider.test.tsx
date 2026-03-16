import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WalletSdkProvider } from '../providers/WalletSdkProvider';
import { sepolia } from 'viem/chains';

vi.mock('@privy-io/react-auth', () => ({
  PrivyProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="privy">{children}</div>
  ),
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
});
