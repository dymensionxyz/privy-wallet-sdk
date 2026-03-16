# Privy Wallet SDK

React SDK wallet component with **Privy** auth (email / socials / wallet), account **funding**, and **deposit** into a smart contract.

## Install

```bash
npm i privy-wallet-sdk
# peer deps
npm i react react-dom @privy-io/react-auth @privy-io/wagmi @tanstack/react-query wagmi viem
```

## Setup

1. Get a [Privy App ID](https://dashboard.privy.io) and configure login methods and (optionally) funding.
2. Wrap your app with `WalletSdkProvider` and pass your config:

```tsx
import { WalletSdkProvider } from 'privy-wallet-sdk';
import { mainnet, sepolia } from 'viem/chains';

const config = {
  appId: import.meta.env.VITE_PRIVY_APP_ID,
  chains: [sepolia, mainnet],
  depositContractAddress: '0x…', // optional, for useDeposit
};

export default function App() {
  return (
    <WalletSdkProvider config={config}>
      <YourApp />
    </WalletSdkProvider>
  );
}
```

## Usage

### Login / Logout

```tsx
import { useWalletAuth } from 'privy-wallet-sdk';

function LoginButton() {
  const { login, logout, isAuthenticated, address } = useWalletAuth();

  if (!isAuthenticated) {
    return <button onClick={login}>Log in (email / social / wallet)</button>;
  }
  return (
    <div>
      <span>{address}</span>
      <button onClick={logout}>Log out</button>
    </div>
  );
}
```

Login methods (email, Google, Twitter, wallet, etc.) are configured in your `WalletSdkProvider` config via `privyConfig.loginMethods` and in the Privy Dashboard.

### Account funding

Opens Privy’s funding modal (on-ramp / transfer) for the connected wallet:

```tsx
import { useAccountFunding } from 'privy-wallet-sdk';

function FundButton() {
  const { fundAccount, status, error } = useAccountFunding();

  return (
    <div>
      <button onClick={() => fundAccount()} disabled={status === 'pending'}>
        {status === 'pending' ? 'Opening…' : 'Fund account'}
      </button>
      {error && <p>{error}</p>}
    </div>
  );
}
```

Optional: pass an address and/or options (chain, amount, asset):

```tsx
fundAccount(undefined, { chain: base, amount: '0.01', asset: 'native-currency' });
```

### Deposit into contract

Calls a contract’s `deposit()` (payable) and tracks tx status:

```tsx
import { useDeposit } from 'privy-wallet-sdk';

function DepositButton() {
  const contractAddress = '0x…'; // from your config or env
  const { deposit, status, hash, receipt, error } = useDeposit({
    contractAddress,
  });

  return (
    <div>
      <button onClick={() => deposit()} disabled={status === 'pending'}>
        {status === 'pending' ? 'Confirming…' : 'Deposit'}
      </button>
      {hash && <p>Tx: {hash}</p>}
      {receipt && <p>Block: {receipt.blockNumber.toString()}</p>}
      {error && <p>{error}</p>}
    </div>
  );
}
```

To send ETH with the call: `deposit(parseEther('0.01'))`.

## API

- **WalletSdkProvider** – `config: WalletSdkConfig`, `children`
- **useWalletAuth()** – `login`, `logout`, `isReady`, `isAuthenticated`, `user`, `address`
- **useAccountFunding()** – `fundAccount(address?, options?)`, `status`, `error`, `reset`
- **useDeposit(options)** – `deposit(valueWei?)`, `status`, `result`, `hash`, `receipt`, `error`, `reset`

## Example test page

From the repo root:

```bash
npm install
npm run build
cd example/test-page && npm install && npm run dev
```

Then open the dev server URL and try login, funding, and deposit (with a stub contract).

## Env

See [.env.example](.env.example) for `VITE_PRIVY_APP_ID` and optional RPC / contract address.
