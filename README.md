# Privy Wallet SDK

React SDK for **Privy**-powered wallet auth, vault deposits, and message signing.

Handles embedded-wallet creation, on-ramp funding (MoonPay / card / exchange), smart-contract deposits, and EIP-191 message signing — all through a small set of hooks so your app never imports `wagmi` or `@privy-io/react-auth` directly.

## Install

```bash
npm i privy-wallet-sdk
# peer deps
npm i react react-dom @privy-io/react-auth @privy-io/wagmi @tanstack/react-query wagmi viem
```

## Setup

1. Get a [Privy App ID](https://dashboard.privy.io) and configure login methods and (optionally) funding.
2. Wrap your app with `WalletSdkProvider`:

```tsx
import { WalletSdkProvider } from 'privy-wallet-sdk';
import { sepolia } from 'viem/chains';

const config = {
  appId: import.meta.env.VITE_PRIVY_APP_ID,
  chains: [sepolia],
};

export default function App() {
  return (
    <WalletSdkProvider config={config}>
      <YourApp />
    </WalletSdkProvider>
  );
}
```

The provider composes `PrivyProvider`, `QueryClientProvider`, and `WagmiProvider` internally. It **guarantees** that users who authenticate via email / social (non-wallet) methods get an embedded Ethereum wallet created automatically — this default is preserved even when you supply custom `privyConfig`.

## Usage

### 1. Login / Logout

```tsx
import { useWalletAuth } from 'privy-wallet-sdk';

function LoginButton() {
  const { login, logout, isAuthenticated, address, hasWallet } = useWalletAuth();

  if (!isAuthenticated) {
    return <button onClick={login}>Log in</button>;
  }
  return (
    <div>
      <p>{address}</p>
      <p>Wallet ready: {hasWallet ? 'yes' : 'no'}</p>
      <button onClick={logout}>Log out</button>
    </div>
  );
}
```

`hasWallet` is `true` once the user is authenticated **and** a usable wallet address is available (either external or auto-created embedded wallet).

### 2. Vault Deposit (high-level)

`useVaultDeposit` orchestrates the full USDC deposit flow into `CasinoVault`.
Amounts are always in **USDC units (6 decimals)** — e.g. `parseUnits('10', 6)` = 10 USDC.

Each deposit executes two on-chain transactions automatically:
1. **ERC-20 approve** — grants the vault allowance to pull USDC from your wallet.
2. **CasinoVault.deposit** — transfers USDC into the vault and credits your account balance.

`accountId` is derived from the connected wallet address automatically (`bytes32(uint256(uint160(addr)))`).

```tsx
import { useVaultDeposit } from 'privy-wallet-sdk';
import type { CasinoVaultConfig } from 'privy-wallet-sdk';
import { parseUnits } from 'viem';

const vaultConfig: CasinoVaultConfig = {
  vaultAddress: '0x…',   // CasinoVault contract address
  tokenAddress: '0x…',   // USDC token address
};

function DepositSection() {
  const { deposit, fundAndDeposit, status, hash, receipt, error } = useVaultDeposit({
    vault: vaultConfig,
  });

  const amount = parseUnits('10', 6); // 10 USDC

  return (
    <div>
      {/* Path A: user already has USDC in wallet — approve + deposit */}
      <button onClick={() => deposit(amount)} disabled={status !== 'idle'}>
        {status === 'approving' ? 'Approving…' : status === 'depositing' ? 'Depositing…' : 'Deposit 10 USDC'}
      </button>

      {/* Path B: open MoonPay / on-ramp for USDC first, then approve + deposit */}
      <button onClick={() => fundAndDeposit(amount)} disabled={status !== 'idle'}>
        {status === 'funding' ? 'Funding…' : 'Buy USDC & Deposit'}
      </button>

      {hash && <p>Tx: {hash}</p>}
      {receipt && <p>Block: {receipt.blockNumber.toString()}</p>}
      {error && <p>{error}</p>}
    </div>
  );
}
```

**Status transitions:**

| Path | Sequence |
|---|---|
| `deposit()` | `idle → approving → depositing → success` |
| `fundAndDeposit()` | `idle → funding → approving → depositing → success` |
| Any failure | `→ error` |

### 3. Message Signing

```tsx
import { useMessageSigning } from 'privy-wallet-sdk';

function SignSection() {
  const { signMessage, status, signature, error } = useMessageSigning();

  const handleSign = async () => {
    const sig = await signMessage('payload to sign');
    if (sig) {
      // sig is the 0x-prefixed hex signature — send it to your backend
      await fetch('/api/verify', {
        method: 'POST',
        body: JSON.stringify({ signature: sig }),
      });
    }
  };

  return (
    <div>
      <button onClick={handleSign} disabled={status === 'pending'}>
        {status === 'pending' ? 'Signing…' : 'Sign'}
      </button>
      {error && <p>{error}</p>}
    </div>
  );
}
```

### Low-level hooks

The high-level hooks above compose this lower-level primitive, which is still exported for advanced use cases:

- **`useAccountFunding()`** — opens Privy's funding modal directly.

## API Reference

| Export | Description |
|---|---|
| `WalletSdkProvider` | Provider — `config: WalletSdkConfig`, `children` |
| `useWalletAuth()` | `login`, `logout`, `isReady`, `isAuthenticated`, `hasWallet`, `user`, `address` |
| `useVaultDeposit(opts)` | `deposit(amount)`, `fundAndDeposit(amount, fundingOpts?)`, `status`, `hash`, `receipt`, `error`, `reset` |
| `useMessageSigning()` | `signMessage(msg)`, `status`, `signature`, `error`, `reset` |
| `useAccountFunding()` | `fundAccount(address?, options?)`, `status`, `error`, `reset` |

## Example test page

```bash
npm install
npm run build
cd example/test-page && npm install && npm run dev
```

The test page demonstrates all three flows: login, vault deposit (both paths), and sign-message with a debug backend submit.

### Env

See [.env.example](.env.example) for required and optional variables:

| Variable | Required | Description |
|---|---|---|
| `VITE_PRIVY_APP_ID` | yes | Privy app ID |
| `VITE_VAULT_ADDRESS` | yes | `CasinoVault` contract address |
| `VITE_USDC_ADDRESS` | yes | USDC ERC-20 token address |
| `VITE_RPC_URL` | no | RPC endpoint (defaults to Anvil `http://127.0.0.1:8545`) |
| `VITE_SERVER_URL` | no | Backend URL for the sign-message debug submit (e.g. `http://localhost:8080`) |
