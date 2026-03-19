import { useState, useRef, useCallback } from 'react';
import { useOAuthTokens } from '@privy-io/react-auth';
import {
  WalletSdkProvider,
  useWalletAuth,
  useVaultDeposit,
  useMessageSigning,
} from 'privy-wallet-sdk';
import type { FundAccountOptions } from 'privy-wallet-sdk';
import { sepolia } from 'viem/chains';
import { parseEther } from 'viem';

const appId = import.meta.env.VITE_PRIVY_APP_ID ?? '';
const serverUrl = (import.meta.env.VITE_SERVER_URL ?? '').replace(/\/$/, '');
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

const sdkConfig = {
  appId,
  chains: [sepolia] as [typeof sepolia],
};

// ---------------------------------------------------------------------------
// Test page inner component (must be inside WalletSdkProvider)
// ---------------------------------------------------------------------------

type FundingAsset = 'native-currency' | 'USDC';

function TestPage() {
  const auth = useWalletAuth();
  // Phase 1: no vault contract — deposit actions fund the embedded wallet directly.
  const vault = useVaultDeposit();
  const signing = useMessageSigning();

  const [depositAmount, setDepositAmount] = useState('0.001');
  const [fundingAsset, setFundingAsset] = useState<FundingAsset>('native-currency');
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
        console.debug('[Profile] No cached Google token, requesting reauthorization…');
        await reauthorize({ provider: 'google' });
      }
      const token = googleTokenRef.current;
      console.debug('[Profile] Google token present:', !!token);
      console.debug('[Profile] Token preview:', token ? `${token.slice(0, 20)}…(${token.length} chars)` : 'null');
      if (!token) throw new Error('Google token not available after reauthorization');

      const url = `${serverUrl}/api/builders/me`;
      console.debug('[Profile] GET', url);
      console.debug('[Profile] Authorization header:', `Bearer ${token.slice(0, 20)}…`);

      const res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      console.debug('[Profile] Response status:', res.status, res.statusText);
      if (!res.ok) {
        const body = await res.text();
        console.error('[Profile] Error body:', body);
        throw new Error(body || `HTTP ${res.status}`);
      }
      const data = await res.json();
      console.debug('[Profile] Success payload:', data);
      setProfileData(data);
      setProfileStatus('success');
    } catch (err) {
      console.error('[Profile] Fetch failed:', err);
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

  const fundingOptions: FundAccountOptions = {
    asset: fundingAsset,
    amount: depositAmount || undefined,
  };

  return (
    <div>
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
          {/* ---- 2. Fund Account ------------------------------------- */}
          <section style={{ marginBottom: 24 }}>
            <h2>Fund Account</h2>
            <p style={{ fontSize: 12, color: '#71717a' }}>
              Phase 1: funds go directly into the embedded wallet (no vault contract).
            </p>

            <div style={{ display: 'flex', gap: 16, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <label>
                Asset:{' '}
                <select
                  value={fundingAsset}
                  onChange={(e) => setFundingAsset(e.target.value as FundingAsset)}
                  style={{ padding: 4 }}
                >
                  <option value="native-currency">ETH</option>
                  <option value="USDC">USDC</option>
                </select>
              </label>

              <label>
                Amount:{' '}
                <input
                  type="text"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder={fundingAsset === 'USDC' ? 'e.g. 10' : 'e.g. 0.001'}
                  style={{ padding: 6, width: 100 }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button
                type="button"
                onClick={() => vault.fundAndDeposit(fundingAsset === 'native-currency' ? valueWei : undefined, fundingOptions)}
                disabled={vault.status === 'funding'}
              >
                {vault.status === 'funding' ? 'Funding…' : `Fund with ${fundingAsset === 'USDC' ? 'USDC' : 'ETH'}`}
              </button>

              {vault.status !== 'idle' && (
                <button type="button" onClick={vault.reset}>
                  Reset
                </button>
              )}
            </div>

            {vault.status === 'success' && (
              <p style={{ color: '#4ade80' }}>Wallet funded successfully.</p>
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
// Vanilla Google Login (no Privy) — uses Google Identity Services directly
// ---------------------------------------------------------------------------

function VanillaGoogleLogin() {
  const [idToken, setIdToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const initializedRef = useRef(false);
  const buttonRef = useRef<HTMLDivElement | null>(null);

  const [profileData, setProfileData] = useState<unknown>(null);
  const [profileStatus, setProfileStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [profileError, setProfileError] = useState<string | null>(null);

  const handleCredential = useCallback((response: CredentialResponse) => {
    const jwt = response.credential;
    console.debug('[VanillaGoogle] ID token (JWT) received:', `${jwt.slice(0, 20)}…(${jwt.length} chars)`);

    // Decode the JWT payload to extract the email (no verification needed client-side)
    try {
      const payload = JSON.parse(atob(jwt.split('.')[1]));
      console.debug('[VanillaGoogle] JWT payload:', payload);
      setUserEmail(payload.email ?? null);
    } catch {
      console.warn('[VanillaGoogle] Could not decode JWT payload');
    }

    setIdToken(jwt);
    setLoginError(null);
  }, []);

  const initGsi = useCallback((node: HTMLDivElement | null) => {
    buttonRef.current = node;
    if (!node || initializedRef.current || !googleClientId) return;
    if (typeof google === 'undefined') return;

    google.accounts.id.initialize({
      client_id: googleClientId,
      callback: handleCredential,
    });
    google.accounts.id.renderButton(node, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
    });
    initializedRef.current = true;
  }, [handleCredential]);

  const handleLogout = () => {
    if (userEmail) {
      google.accounts.id.disableAutoSelect();
    }
    setIdToken(null);
    setUserEmail(null);
    setProfileData(null);
    setProfileStatus('idle');
    setProfileError(null);
    initializedRef.current = false;
  };

  const handleFetchProfile = async () => {
    if (!serverUrl || !idToken) return;
    setProfileStatus('pending');
    setProfileError(null);
    try {
      const url = `${serverUrl}/api/builders/me`;
      console.debug('[VanillaGoogle] GET', url);
      console.debug('[VanillaGoogle] ID token preview:', `${idToken.slice(0, 20)}…(${idToken.length} chars)`);
      console.debug('[VanillaGoogle] Authorization header:', `Bearer ${idToken.slice(0, 20)}…`);

      const res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${idToken}` },
      });

      console.debug('[VanillaGoogle] Response status:', res.status, res.statusText);
      if (!res.ok) {
        const body = await res.text();
        console.error('[VanillaGoogle] Error body:', body);
        throw new Error(body || `HTTP ${res.status}`);
      }
      const data = await res.json();
      console.debug('[VanillaGoogle] Success payload:', data);
      setProfileData(data);
      setProfileStatus('success');
    } catch (err) {
      console.error('[VanillaGoogle] Fetch failed:', err);
      setProfileStatus('error');
      setProfileError(err instanceof Error ? err.message : String(err));
    }
  };

  if (!googleClientId) {
    return (
      <section style={{ marginBottom: 24, padding: 16, border: '1px solid #3f3f46', borderRadius: 8 }}>
        <h2>Vanilla Google Login (no Privy)</h2>
        <p style={{ fontSize: 12, color: '#71717a' }}>
          Set VITE_GOOGLE_CLIENT_ID in .env to enable.
        </p>
      </section>
    );
  }

  return (
    <section style={{ marginBottom: 24, padding: 16, border: '1px solid #3f3f46', borderRadius: 8 }}>
      <h2>Vanilla Google Login (no Privy)</h2>
      <p style={{ fontSize: 12, color: '#71717a', marginBottom: 8 }}>
        Uses Google Identity Services directly — ID token (JWT) sent to {serverUrl || '—'}/api/builders/me
      </p>

      {!idToken ? (
        <div ref={initGsi} />
      ) : (
        <div>
          <p>Signed in{userEmail ? `: ${userEmail}` : ''}</p>
          <p style={{ fontSize: 12, color: '#71717a' }}>
            ID token: {idToken.slice(0, 24)}…
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              type="button"
              onClick={handleFetchProfile}
              disabled={profileStatus === 'pending' || !serverUrl}
            >
              {profileStatus === 'pending' ? 'Loading…' : 'Fetch Profile'}
            </button>
            <button type="button" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
      )}

      {profileStatus === 'success' && profileData !== null && (
        <pre style={{ marginTop: 8, padding: 8, background: '#27272a', color: '#e4e4e7', borderRadius: 4, overflow: 'auto', fontSize: 12 }}>
          {JSON.stringify(profileData, null, 2)}
        </pre>
      )}
      {profileError && (
        <p style={{ color: '#f87171', marginTop: 8 }}>{profileError}</p>
      )}
      {loginError && (
        <p style={{ color: '#f87171', marginTop: 8 }}>{loginError}</p>
      )}
    </section>
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
    <div style={{ padding: 24, maxWidth: 480, margin: '0 auto' }}>
      <VanillaGoogleLogin />
      <WalletSdkProvider config={sdkConfig}>
        <TestPage />
      </WalletSdkProvider>
    </div>
  );
}
