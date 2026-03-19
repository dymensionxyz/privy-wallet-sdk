import type { Abi, Chain } from 'viem';

/** Config passed to WalletSdkProvider */
export interface WalletSdkConfig {
  /** Privy app ID from dashboard */
  appId: string;
  /** Chains for wagmi (at least one; optional RPC overrides) */
  chains: [Chain, ...Chain[]];
  /** Optional: custom RPC URLs per chain id */
  rpcUrls?: Partial<Record<number, string>>;
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

// ---------------------------------------------------------------------------
// Funding
// ---------------------------------------------------------------------------

/** Normalized funding status for useAccountFunding */
export type FundingStatus = 'idle' | 'pending' | 'success' | 'error';

// ---------------------------------------------------------------------------
// Low-level deposit (useDeposit)
// ---------------------------------------------------------------------------

/** Deposit tx status for useDeposit */
export type DepositStatus = 'idle' | 'pending' | 'success' | 'error';

/** Result of a deposit() call */
export interface DepositResult {
  hash?: `0x${string}`;
  receipt?: { status: 'success' | 'reverted'; blockNumber: bigint };
  error?: Error;
}

// ---------------------------------------------------------------------------
// High-level vault deposit (useVaultDeposit)
// ---------------------------------------------------------------------------

/** Contract call configuration for the vault deposit hook. */
export interface VaultContractConfig {
  /** Contract address */
  address: `0x${string}`;
  /** Contract ABI (must include the target function) */
  abi: Abi;
  /** Function name to invoke */
  functionName: string;
  /** Optional static args passed to the function on every call */
  args?: readonly unknown[];
}

/**
 * Multi-phase status for the vault deposit flow.
 * - idle → funding → depositing → success
 * - Any phase can transition to error.
 */
export type VaultDepositStatus = 'idle' | 'funding' | 'depositing' | 'success' | 'error';

/** Result returned by useVaultDeposit */
export interface VaultDepositResult {
  hash?: `0x${string}`;
  receipt?: { status: 'success' | 'reverted'; blockNumber: bigint };
  error?: Error;
}

// ---------------------------------------------------------------------------
// Message signing (useMessageSigning)
// ---------------------------------------------------------------------------

/** Options for signMessage */
export interface SignMessageOptions {
  /** When true (default), signMessage throws on failure instead of returning undefined. */
  throwOnError?: boolean;
}

/** Status for the message signing hook */
export type SigningStatus = 'idle' | 'pending' | 'success' | 'error';

/** Result of a signMessage call */
export interface SigningResult {
  signature?: `0x${string}`;
  error?: Error;
}
