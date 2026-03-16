import {
  WalletSdkProvider,
  useWalletAuth,
  useAccountFunding,
  useDeposit,
} from 'privy-wallet-sdk';
import { sepolia } from 'viem/chains';

const appId = import.meta.env.VITE_PRIVY_APP_ID ?? '';
const depositContractAddress = (import.meta.env.VITE_DEPOSIT_CONTRACT_ADDRESS ??
  '0x0000000000000000000000000000000000000000') as `0x${string}`;

const sdkConfig = {
  appId,
  chains: [sepolia],
  depositContractAddress,
};

function TestPage() {
  const auth = useWalletAuth();
  const funding = useAccountFunding();
  const deposit = useDeposit({ contractAddress: depositContractAddress });

  return (
    <div style={{ padding: 24, maxWidth: 480, margin: '0 auto' }}>
      <h1>Wallet SDK Test Page</h1>

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
            <button type="button" onClick={auth.logout}>
              Log out
            </button>
          </div>
        )}
      </section>

      {auth.isAuthenticated && (
        <>
          <section style={{ marginBottom: 24 }}>
            <h2>Funding</h2>
            <button
              type="button"
              onClick={() => funding.fundAccount()}
              disabled={funding.status === 'pending'}
            >
              {funding.status === 'pending' ? 'Opening funding…' : 'Fund account'}
            </button>
            {funding.error && <p style={{ color: '#f87171' }}>{funding.error}</p>}
            {funding.status === 'success' && (
              <p style={{ color: '#4ade80' }}>Funding flow completed.</p>
            )}
          </section>

          <section>
            <h2>Deposit</h2>
            <p style={{ fontSize: 12, color: '#71717a' }}>
              Contract: {depositContractAddress}
            </p>
            <button
              type="button"
              onClick={() => deposit.deposit()}
              disabled={deposit.status === 'pending'}
            >
              {deposit.status === 'pending' ? 'Confirming…' : 'Deposit'}
            </button>
            {deposit.hash && <p>Tx: {deposit.hash}</p>}
            {deposit.receipt && (
              <p>Block: {deposit.receipt.blockNumber.toString()}</p>
            )}
            {deposit.error && (
              <p style={{ color: '#f87171' }}>{deposit.error}</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

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
