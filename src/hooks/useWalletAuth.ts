import { useEffect } from 'react';
import { useLogin, useLogout, usePrivy, useWallets } from '@privy-io/react-auth';
import { useSetActiveWallet } from '@privy-io/wagmi';
import { useAccount } from 'wagmi';

/**
 * Auth and session state for the wallet SDK.
 *
 * Login guarantees an embedded Ethereum wallet is created for users who
 * authenticate via email / social (non-wallet) methods — this is enforced
 * by the provider's config merge, not by consumer opt-in.
 */
export function useWalletAuth() {
  const { ready, authenticated, user } = usePrivy();
  const { login } = useLogin();
  const { logout } = useLogout();
  const { address } = useAccount();
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();

  useEffect(() => {
    if (!authenticated || wallets.length === 0) return;

    const embeddedWallet = wallets.find(
      (wallet) => wallet.walletClientType === 'privy',
    );
    if (embeddedWallet) {
      setActiveWallet(embeddedWallet);
    }
  }, [authenticated, wallets, setActiveWallet]);

  const walletAddress = address ?? (user?.wallet?.address as `0x${string}` | undefined);

  return {
    /** Open Privy login modal (email / social / wallet based on config) */
    login,
    /** Log out and clear session */
    logout,
    /** Privy SDK ready */
    isReady: ready,
    /** User is authenticated */
    isAuthenticated: authenticated,
    /** Privy user object */
    user,
    /** Active wallet address (wagmi or embedded) */
    address: walletAddress,
    /** True when authenticated and a usable wallet address is available */
    hasWallet: authenticated && !!walletAddress,
  };
}
