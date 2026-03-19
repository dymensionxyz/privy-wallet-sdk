export { WalletSdkProvider } from './providers/WalletSdkProvider';
export { createWalletSdkConfig } from './config/defaults';
export { useWalletAuth } from './hooks/useWalletAuth';
export { useAccountFunding } from './hooks/useAccountFunding';
export { useDeposit } from './hooks/useDeposit';
export { useVaultDeposit } from './hooks/useVaultDeposit';
export { useMessageSigning } from './hooks/useMessageSigning';
export type { FundAccountOptions } from './hooks/useAccountFunding';
export type { UseDepositOptions } from './hooks/useDeposit';
export type { UseVaultDepositOptions } from './hooks/useVaultDeposit';

export type {
  WalletSdkConfig,
  PrivyClientConfigLike,
  FundingStatus,
  DepositStatus,
  DepositResult,
  VaultContractConfig,
  VaultDepositStatus,
  VaultDepositResult,
  SigningStatus,
  SigningResult,
  SignMessageOptions,
} from './types/public';
export { WalletSdkError } from './utils/errors';
