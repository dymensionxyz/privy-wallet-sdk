export { WalletSdkProvider } from './providers/WalletSdkProvider';
export { useWalletAuth } from './hooks/useWalletAuth';
export { useAccountFunding } from './hooks/useAccountFunding';
export { useDeposit } from './hooks/useDeposit';
export type { FundAccountOptions } from './hooks/useAccountFunding';
export type { UseDepositOptions } from './hooks/useDeposit';

export type {
  WalletSdkConfig,
  PrivyClientConfigLike,
  FundingStatus,
  DepositStatus,
  DepositResult,
} from './types/public';
export { WalletSdkError } from './utils/errors';
