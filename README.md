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

`useVaultDeposit` orchestrates the full deposit flow: optionally open Privy funding first, then execute a configurable contract call.

```tsx
import { useVaultDeposit } from 'privy-wallet-sdk';
import type { VaultContractConfig } from 'privy-wallet-sdk';
import { parseEther } from 'viem';

const vaultContract: VaultContractConfig = {
  address: '0x…',
  abi: [{ name: 'deposit', type: 'function', stateMutability: 'payable', inputs: [], outputs: [] }],
  functionName: 'deposit',
};

function DepositSection() {
  const { deposit, fundAndDeposit, status, hash, receipt, error } = useVaultDeposit({
    contract: vaultContract,
  });

  return (
    <div>
      {/* Path A: user already has funds in wallet */}
      <button onClick={() => deposit(parseEther('0.01'))} disabled={status !== 'idle'}>
        Deposit from wallet
      </button>

      {/* Path B: open MoonPay / on-ramp first, then deposit */}
      <button onClick={() => fundAndDeposit(parseEther('0.01'))} disabled={status !== 'idle'}>
        Buy & Deposit
      </button>

      {hash && <p>Tx: {hash}</p>}
      {receipt && <p>Block: {receipt.blockNumber.toString()}</p>}
      {error && <p>{error}</p>}
    </div>
  );
}
```

The `VaultContractConfig` lets you point at any contract/function — the hook is not locked to a specific ABI shape.

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

The high-level hooks above compose these lower-level primitives, which are still exported for advanced use cases:

- **`useAccountFunding()`** — opens Privy's funding modal directly.
- **`useDeposit({ contractAddress })`** — calls a hardcoded payable `deposit()` and tracks tx status.

## API Reference

| Export | Description |
|---|---|
| `WalletSdkProvider` | Provider — `config: WalletSdkConfig`, `children` |
| `useWalletAuth()` | `login`, `logout`, `isReady`, `isAuthenticated`, `hasWallet`, `user`, `address` |
| `useVaultDeposit(opts)` | `deposit(value?)`, `fundAndDeposit(value?, fundingOpts?)`, `status`, `hash`, `receipt`, `error`, `reset` |
| `useMessageSigning()` | `signMessage(msg)`, `status`, `signature`, `error`, `reset` |
| `useAccountFunding()` | `fundAccount(address?, options?)`, `status`, `error`, `reset` |
| `useDeposit(opts)` | `deposit(valueWei?)`, `status`, `result`, `hash`, `receipt`, `error`, `reset` |

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
| `VITE_DEPOSIT_CONTRACT_ADDRESS` | no | Vault contract address (defaults to zero address) |
| `VITE_SERVER_URL` | no | Backend URL for the sign-message debug submit (e.g. `http://localhost:8080`) |
