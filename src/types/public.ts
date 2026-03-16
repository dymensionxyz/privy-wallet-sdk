import type { Chain } from 'viem';

/** Config passed to WalletSdkProvider */
export interface WalletSdkConfig {
  /** Privy app ID from dashboard */
  appId: string;
  /** Chains for wagmi (at least one; optional RPC overrides) */
  chains: [Chain, ...Chain[]];
  /** Optional: custom RPC URLs per chain id */
  rpcUrls?: Partial<Record<number, string>>;
  /** Deposit contract address (for useDeposit) */
  depositContractAddress?: `0x${string}`;
  /** Optional Privy client config (login methods, appearance, etc.) */
  privyConfig?: PrivyClientConfigLike;
}

/** Minimal Privy config shape we forward; full type from @privy-io/react-auth */
export interface PrivyClientConfigLike {
  loginMethods?: Array<'wallet' | 'email' | 'sms' | 'google' | 'twitter' | 'discord' | 'github' | 'linkedin' | 'spotify' | 'instagram' | 'tiktok' | 'line' | 'twitch' | 'apple' | 'farcaster' | 'telegram' | 'passkey'>;
  embeddedWallets?: {
    ethereum?: { createOnLogin?: 'all-users' | 'users-without-wallets' | 'off' };
    solana?: { createOnLogin?: 'all-users' | 'users-without-wallets' | 'off' };
    showWalletUIs?: boolean;
  };
  appearance?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Normalized funding status for useAccountFunding */
export type FundingStatus = 'idle' | 'pending' | 'success' | 'error';

/** Deposit tx status for useDeposit */
export type DepositStatus = 'idle' | 'pending' | 'success' | 'error';

/** Result of a deposit() call */
export interface DepositResult {
  hash?: `0x${string}`;
  receipt?: { status: 'success' | 'reverted'; blockNumber: bigint };
  error?: Error;
}
