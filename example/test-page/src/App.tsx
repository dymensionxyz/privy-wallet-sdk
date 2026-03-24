import { useState } from 'react';
import {
  WalletSdkProvider,
  useWalletAuth,
  useVaultDeposit,
  useMessageSigning,
} from 'privy-wallet-sdk';
import type { FundAccountOptions } from 'privy-wallet-sdk';
import { useBalance, useReadContract } from 'wagmi';
import { anvil } from 'viem/chains';
import { parseUnits, formatUnits, pad, toHex } from 'viem';

const appId = import.meta.env.VITE_PRIVY_APP_ID ?? '';
const serverUrl = (import.meta.env.VITE_SERVER_URL ?? '').replace(/\/$/, '');
const vaultAddress = (import.meta.env.VITE_VAULT_ADDRESS ?? '') as `0x${string}`;
const usdcAddress = (import.meta.env.VITE_USDC_ADDRESS ?? '') as `0x${string}`;

const sdkConfig = {
  appId,
  chains: [anvil] as [typeof anvil],
};

// Minimal ABI for CasinoVault.getSettledBalance(bytes32, address) → uint256
const VAULT_BALANCE_ABI = [
  {
    name: 'getSettledBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'accountId', type: 'bytes32' },
      { name: 'token', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// Minimal ABI for ERC20.balanceOf(address) -> uint256
const ERC20_BALANCE_OF_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

/** Derive CasinoVault accountId from wallet address: bytes32(uint256(uint160(addr))) */
function deriveAccountId(address: `0x${string}`): `0x${string}` {
  return pad(toHex(BigInt(address)), { size: 32 });
}

// ---------------------------------------------------------------------------
// Balances section
// ---------------------------------------------------------------------------

function BalancesSection({ address }: { address: `0x${string}` }) {
  const accountId = deriveAccountId(address);

  const { data: ethBalance } = useBalance({ address });
  const {
    data: usdcWalletBalance,
    error: usdcWalletBalanceError,
    isFetching: isUsdcWalletBalanceFetching,
  } = useReadContract({
    address: usdcAddress || undefined,
    abi: ERC20_BALANCE_OF_ABI,
    functionName: 'balanceOf',
    args: [address],
    // Local Anvil tokens may not fully support metadata paths used by useBalance(token),
    // so read the canonical ERC-20 balance directly.
    query: {
      enabled: Boolean(usdcAddress),
      retry: false,
    },
  });
  const {
    data: vaultBalance,
    refetch: refetchVault,
    error: vaultBalanceError,
    isFetching: isVaultBalanceFetching,
  } = useReadContract({
    address: vaultAddress || undefined,
    abi: VAULT_BALANCE_ABI,
    functionName: 'getSettledBalance',
    args: [accountId, usdcAddress],
    // Reverts are expected when vault/token deployment is mismatched; avoid noisy retries.
    query: {
      enabled: Boolean(vaultAddress && usdcAddress),
      retry: false,
    },
  });

  const noConfig = !vaultAddress || !usdcAddress;

  return (
    <section style={{ marginBottom: 24 }}>
      <h2>Balances</h2>
      {noConfig && (
        <p style={{ fontSize: 12, color: '#a1a1aa' }}>
          Set VITE_VAULT_ADDRESS and VITE_USDC_ADDRESS in .env to see balances.
        </p>
      )}
      <table style={{ borderCollapse: 'collapse', fontSize: 14 }}>
        <tbody>
          <tr>
            <td style={{ paddingRight: 16, color: '#a1a1aa' }}>ETH</td>
            <td>
              {ethBalance
                ? `${parseFloat(formatUnits(ethBalance.value, 18)).toFixed(6)} ETH`
                : '—'}
            </td>
          </tr>
          <tr>
            <td style={{ paddingRight: 16, color: '#a1a1aa' }}>USDC (wallet)</td>
            <td>
              {isUsdcWalletBalanceFetching
                ? 'Loading...'
                : usdcWalletBalance !== undefined
                ? `${parseFloat(formatUnits(usdcWalletBalance as bigint, 6)).toFixed(2)} USDC`
                : '—'}
            </td>
          </tr>
          <tr>
            <td style={{ paddingRight: 16, color: '#a1a1aa' }}>Vault settled</td>
            <td>
              {isVaultBalanceFetching
                ? 'Loading...'
                : vaultBalance !== undefined
                ? `${parseFloat(formatUnits(vaultBalance as bigint, 6)).toFixed(2)} USDC`
                : '—'}
            </td>
          </tr>
        </tbody>
      </table>
      {!noConfig && vaultBalanceError && (
        <p style={{ marginTop: 8, fontSize: 12, color: '#f87171' }}>
          Vault balance read reverted. Verify that `VITE_VAULT_ADDRESS` and `VITE_USDC_ADDRESS`
          are from the same Anvil deployment and the token is supported by the vault.
        </p>
      )}
      {!!usdcAddress && usdcWalletBalanceError && (
        <p style={{ marginTop: 8, fontSize: 12, color: '#f87171' }}>
          USDC wallet balance read failed. Verify `VITE_USDC_ADDRESS` points to an ERC-20 token
          deployed on the current Anvil instance.
        </p>
      )}
      {!noConfig && (
        <button
          type="button"
          onClick={() => refetchVault()}
          style={{ marginTop: 8, fontSize: 12 }}
        >
          Refresh vault balance
        </button>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Test page inner component (must be inside WalletSdkProvider)
// ---------------------------------------------------------------------------

function TestPage() {
  const auth = useWalletAuth();
  const vault = useVaultDeposit({
    vault: { vaultAddress, tokenAddress: usdcAddress },
  });
  const signing = useMessageSigning();

  const [depositAmount, setDepositAmount] = useState('10');
  const [validationMessage, setValidationMessage] = useState('');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSignAndSend = async () => {
    if (!serverUrl || !auth.address || !validationMessage.trim()) return;
    setSubmitStatus('pending');
    setSubmitError(null);
    try {
      const signature = await signing.signMessage(validationMessage);
      const res = await fetch(`${serverUrl}/testvalidation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: auth.address, message: validationMessage, signature }),
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      setSubmitStatus('success');
    } catch (err) {
      setSubmitStatus('error');
      setSubmitError(err instanceof Error ? err.message : String(err));
    }
  };

  // Parse USDC amount: decimal string → bigint (6 decimals)
  const usdcAmount = (() => {
    try { return parseUnits(depositAmount || '0', 6); } catch { return undefined; }
  })();

  const depositDisabled =
    vault.status !== 'idle' || !usdcAmount || usdcAmount <= 0n || !vaultAddress || !usdcAddress;

  const fundingOptions: FundAccountOptions = { asset: 'USDC', amount: depositAmount || undefined };

  const depositStatusLabel: Record<typeof vault.status, string> = {
    idle: 'Deposit USDC',
    approving: 'Approving…',
    depositing: 'Depositing…',
    funding: 'Funding…',
    success: 'Deposit USDC',
    error: 'Deposit USDC',
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

      {auth.isAuthenticated && auth.address && (
        <>
          {/* ---- 2. Balances ------------------------------------------ */}
          <BalancesSection address={auth.address} />

          {/* ---- 3. Deposit ------------------------------------------- */}
          <section style={{ marginBottom: 24 }}>
            <h2>Deposit USDC</h2>
            {(!vaultAddress || !usdcAddress) && (
              <p style={{ fontSize: 12, color: '#a1a1aa' }}>
                Set VITE_VAULT_ADDRESS and VITE_USDC_ADDRESS in .env to enable deposits.
              </p>
            )}

            <div style={{ display: 'flex', gap: 16, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <label>
                Amount (USDC):{' '}
                <input
                  type="text"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="e.g. 10"
                  style={{ padding: 6, width: 100 }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              {/* Path A: deposit from existing wallet balance */}
              <button
                type="button"
                onClick={() => usdcAmount && vault.deposit(usdcAmount)}
                disabled={depositDisabled}
              >
                {depositStatusLabel[vault.status]}
              </button>

              {/* Path B: fund via on-ramp first, then deposit */}
              <button
                type="button"
                onClick={() => usdcAmount && vault.fundAndDeposit(usdcAmount, fundingOptions)}
                disabled={vault.status !== 'idle' || !vaultAddress || !usdcAddress}
              >
                {vault.status === 'funding' ? 'Funding…' : 'Buy USDC & Deposit'}
              </button>

              {vault.status !== 'idle' && (
                <button type="button" onClick={vault.reset}>
                  Reset
                </button>
              )}
            </div>

            {vault.status === 'approving' && (
              <p style={{ color: '#facc15', fontSize: 13 }}>Step 1/2: Approving USDC spend…</p>
            )}
            {vault.status === 'depositing' && (
              <p style={{ color: '#60a5fa', fontSize: 13 }}>Step 2/2: Depositing into vault…</p>
            )}
            {vault.status === 'success' && (
              <p style={{ color: '#4ade80' }}>
                Deposit successful!{vault.hash ? ` Tx: ${vault.hash}` : ''}
              </p>
            )}
            {vault.error && (
              <p style={{ color: '#f87171' }}>{vault.error}</p>
            )}
          </section>

          {/* ---- 4. Sign Message -------------------------------------- */}
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
    <div style={{ padding: 24, maxWidth: 480, margin: '0 auto' }}>
      <WalletSdkProvider config={sdkConfig}>
        <TestPage />
      </WalletSdkProvider>
    </div>
  );
}
