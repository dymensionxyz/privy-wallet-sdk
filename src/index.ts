export { WalletSdkProvider } from './providers/WalletSdkProvider';
export { createWalletSdkConfig } from './config/defaults';
export { useWalletAuth } from './hooks/useWalletAuth';
export { useAccountFunding } from './hooks/useAccountFunding';
export { useVaultDeposit } from './hooks/useVaultDeposit';
export { useMessageSigning } from './hooks/useMessageSigning';
export type { FundAccountOptions } from './hooks/useAccountFunding';
export type { UseVaultDepositOptions } from './hooks/useVaultDeposit';

export type {
  WalletSdkConfig,
  PrivyClientConfigLike,
  FundingStatus,
  CasinoVaultConfig,
  VaultDepositStatus,
  VaultDepositResult,
  SigningStatus,
  SigningResult,
  SignMessageOptions,
} from './types/public';
export { WalletSdkError } from './utils/errors';
