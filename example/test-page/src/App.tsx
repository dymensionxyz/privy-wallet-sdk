import { useState, useRef } from 'react';
import { useOAuthTokens } from '@privy-io/react-auth';
import {
  WalletSdkProvider,
  useWalletAuth,
  useVaultDeposit,
  useMessageSigning,
} from 'privy-wallet-sdk';
import type { VaultContractConfig } from 'privy-wallet-sdk';
import { sepolia } from 'viem/chains';
import { parseEther } from 'viem';

const appId = import.meta.env.VITE_PRIVY_APP_ID ?? '';
const depositContractAddress = (import.meta.env.VITE_DEPOSIT_CONTRACT_ADDRESS ??
  '0x0000000000000000000000000000000000000000') as `0x${string}`;
const serverUrl = (import.meta.env.VITE_SERVER_URL ?? '').replace(/\/$/, '');

const VAULT_ABI = [
  {
    name: 'deposit',
    type: 'function' as const,
    stateMutability: 'payable' as const,
    inputs: [],
    outputs: [],
  },
];

const vaultContract: VaultContractConfig = {
  address: depositContractAddress,
  abi: VAULT_ABI,
  functionName: 'deposit',
};

const sdkConfig = {
  appId,
  chains: [sepolia] as [typeof sepolia],
};

// ---------------------------------------------------------------------------
// Test page inner component (must be inside WalletSdkProvider)
// ---------------------------------------------------------------------------

function TestPage() {
  const auth = useWalletAuth();
  const vault = useVaultDeposit({ contract: vaultContract });
  const signing = useMessageSigning();

  const [depositAmount, setDepositAmount] = useState('0.001');
  const [validationMessage, setValidationMessage] = useState('');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const googleTokenRef = useRef<string | null>(null);
  const [profileData, setProfileData] = useState<unknown>(null);
  const [profileStatus, setProfileStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [profileError, setProfileError] = useState<string | null>(null);

  const { reauthorize } = useOAuthTokens({
    onOAuthTokenGrant: ({ oAuthTokens }) => {
      if (oAuthTokens.provider === 'google') {
        googleTokenRef.current = oAuthTokens.accessToken;
        setGoogleToken(oAuthTokens.accessToken);
      }
    },
  });

  const handleFetchProfile = async () => {
    if (!serverUrl) return;
    setProfileStatus('pending');
    setProfileError(null);
    try {
      if (!googleTokenRef.current) {
        await reauthorize({ provider: 'google' });
      }
      const token = googleTokenRef.current;
      if (!token) throw new Error('Google token not available after reauthorization');

      const res = await fetch(`${serverUrl}/builders/me`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
      setProfileData(await res.json());
      setProfileStatus('success');
    } catch (err) {
      setProfileStatus('error');
      setProfileError(err instanceof Error ? err.message : String(err));
    }
  };

  // -- Sign message via SDK, then POST to backend for debug verification --
  const handleSignAndSend = async () => {
    if (!serverUrl || !auth.address || !validationMessage.trim()) return;
    setSubmitStatus('pending');
    setSubmitError(null);
    try {
      const signature = await signing.signMessage(validationMessage);
      if (!signature) throw new Error(signing.error ?? 'Signing failed');

      const res = await fetch(`${serverUrl}/testvalidation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: auth.address,
          message: validationMessage,
          signature,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      setSubmitStatus('success');
    } catch (err) {
      setSubmitStatus('error');
      setSubmitError(err instanceof Error ? err.message : String(err));
    }
  };

  const valueWei = (() => {
    try { return parseEther(depositAmount || '0'); } catch { return undefined; }
  })();

  return (
    <div style={{ padding: 24, maxWidth: 480, margin: '0 auto' }}>
      <h1>Wallet SDK Test Page</h1>

      {/* ---- 1. Auth -------------------------------------------------- */}
      <section style={{ marginBottom: 24 }}>
        <h2>Auth</h2>
        {!auth.isReady ? (
          <p>Loading…</p>
        ) : !auth.isAuthenticated ? (
          <button type="button" onClick={auth.login}>
            Log in (email / social / wallet)
          </button>
        ) : (
          <div>
            <p>Connected: {auth.address ?? '—'}</p>
            <p style={{ fontSize: 12, color: '#71717a' }}>
              Wallet ready: {auth.hasWallet ? 'yes' : 'no'}
            </p>
            <button type="button" onClick={auth.logout}>
              Log out
            </button>
          </div>
        )}
      </section>

      {auth.isAuthenticated && auth.user?.google && (
        <section style={{ marginBottom: 24 }}>
          <h2>Profile</h2>
          <p style={{ fontSize: 12, color: '#71717a' }}>
            GET {serverUrl || '—'}/builders/me (Bearer: Google OAuth token)
          </p>
          <button
            type="button"
            onClick={handleFetchProfile}
            disabled={profileStatus === 'pending'}
          >
            {profileStatus === 'pending' ? 'Loading…' : 'Profile'}
          </button>
          {!googleToken && profileStatus === 'idle' && (
            <p style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>
              Will request Google authorization if needed.
            </p>
          )}
          {profileStatus === 'success' && profileData !== null && (
            <pre style={{ marginTop: 8, padding: 8, background: '#27272a', color: '#e4e4e7', borderRadius: 4, overflow: 'auto', fontSize: 12 }}>
              {JSON.stringify(profileData, null, 2)}
            </pre>
          )}
          {profileError && (
            <p style={{ color: '#f87171', marginTop: 8 }}>{profileError}</p>
          )}
        </section>
      )}

      {auth.isAuthenticated && (
        <>
          {/* ---- 2. Vault Deposit ------------------------------------- */}
          <section style={{ marginBottom: 24 }}>
            <h2>Vault Deposit</h2>
            <p style={{ fontSize: 12, color: '#71717a' }}>
              Contract: {depositContractAddress}
            </p>

            <label style={{ display: 'block', marginBottom: 8 }}>
              Amount (ETH):{' '}
              <input
                type="text"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                style={{ padding: 6, width: 100 }}
              />
            </label>

            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button
                type="button"
                onClick={() => vault.deposit(valueWei)}
                disabled={vault.status === 'depositing' || vault.status === 'funding'}
              >
                {vault.status === 'depositing' ? 'Confirming…' : 'Deposit from wallet'}
              </button>

              <button
                type="button"
                onClick={() => vault.fundAndDeposit(valueWei)}
                disabled={vault.status === 'depositing' || vault.status === 'funding'}
              >
                {vault.status === 'funding'
                  ? 'Funding…'
                  : 'Buy & Deposit (MoonPay)'}
              </button>
            </div>

            {vault.hash && <p>Tx: {vault.hash}</p>}
            {vault.receipt && (
              <p>Block: {vault.receipt.blockNumber.toString()}</p>
            )}
            {vault.status === 'success' && (
              <p style={{ color: '#4ade80' }}>Deposit succeeded.</p>
            )}
            {vault.error && (
              <p style={{ color: '#f87171' }}>{vault.error}</p>
            )}
          </section>

          {/* ---- 3. Sign Message + Debug Submit ----------------------- */}
          <section style={{ marginBottom: 24 }}>
            <h2>Sign Message</h2>
            <p style={{ fontSize: 12, color: '#71717a' }}>
              Server: {serverUrl || '— (set VITE_SERVER_URL)'}
            </p>
            <input
              type="text"
              value={validationMessage}
              onChange={(e) => setValidationMessage(e.target.value)}
              placeholder="Message to sign"
              style={{ display: 'block', marginBottom: 8, padding: 8, width: '100%', boxSizing: 'border-box' }}
            />
            <button
              type="button"
              onClick={handleSignAndSend}
              disabled={
                submitStatus === 'pending' ||
                signing.status === 'pending' ||
                !serverUrl ||
                !validationMessage.trim()
              }
            >
              {signing.status === 'pending'
                ? 'Signing…'
                : submitStatus === 'pending'
                  ? 'Sending…'
                  : 'Sign & Send to Backend'}
            </button>
            {submitStatus === 'success' && (
              <p style={{ color: '#4ade80' }}>Validation succeeded.</p>
            )}
            {submitError && (
              <p style={{ color: '#f87171' }}>{submitError}</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// App root
// ---------------------------------------------------------------------------

export default function App() {
  if (!appId) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p>Set VITE_PRIVY_APP_ID in .env to run the test page.</p>
      </div>
    );
  }

  return (
    <WalletSdkProvider config={sdkConfig}>
      <TestPage />
    </WalletSdkProvider>
  );
}
