import { useLogin, useLogout, usePrivy } from '@privy-io/react-auth';
import { useAccount } from 'wagmi';

/**
 * Auth and session state for the wallet SDK.
 * - login(): open Privy modal (email, socials, wallet per app config).
 * - logout(): disconnect and clear session.
 * - user, isReady, isAuthenticated, address for UI and guards.
 */
export function useWalletAuth() {
  const { ready, authenticated, user } = usePrivy();
  const { login } = useLogin();
  const { logout } = useLogout();
  const { address } = useAccount();

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
  };
}
