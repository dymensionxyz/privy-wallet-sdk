# privy-wallet-sdk — LLM Integration Spec

> **Purpose**: This document is the authoritative reference for any LLM generating frontend code that integrates `privy-wallet-sdk`. Follow every constraint here exactly; do not import `wagmi`, `@privy-io/react-auth`, or `viem` in consumer components unless explicitly stated below.

---

## 1. Package Identity

| Field | Value |
|---|---|
| npm package | `privy-wallet-sdk` |
| React requirement | React 18+ |
| TypeScript | fully typed; all types importable from `privy-wallet-sdk` |

### 1.1 Install

```bash
npm i privy-wallet-sdk
# required peer deps (do not use older major versions)
npm i react react-dom @privy-io/react-auth @privy-io/wagmi @tanstack/react-query wagmi viem
```

### 1.2 Allowed consumer imports

Consumer code (your app) may import **only** from the following:

| Module | What to import |
|---|---|
| `privy-wallet-sdk` | everything (provider, hooks, types) |
| `viem` | utility functions (`parseEther`, `formatEther`) and chain objects (`sepolia`, `mainnet`, …) |
| `viem/chains` | named chain objects |

Do **not** import from `wagmi`, `@privy-io/react-auth`, `@privy-io/wagmi`, or `@tanstack/react-query` in your own components.

---

## 2. Environment Variables

All env vars use the `VITE_` prefix (Vite projects). Adapt to your bundler if needed.

| Variable | Required | Description |
|---|---|---|
| `VITE_PRIVY_APP_ID` | **yes** | Privy app ID from https://dashboard.privy.io |
| `VITE_DEPOSIT_CONTRACT_ADDRESS` | no | Vault contract address (phase 2 only); not needed for direct wallet funding |
| `VITE_SERVER_URL` | no | Backend base URL for signature verification (e.g. `http://localhost:8080`) |
| `VITE_RPC_URL_SEPOLIA` | no | Custom RPC for Sepolia (Alchemy, Infura, …) |
| `VITE_RPC_URL_MAINNET` | no | Custom RPC for Mainnet |

---

## 3. Provider Setup

**Every hook must be rendered inside `WalletSdkProvider`.** Place it at the root of your application, wrapping everything that needs wallet/auth access.

```tsx
import { WalletSdkProvider } from 'privy-wallet-sdk';
import type { WalletSdkConfig } from 'privy-wallet-sdk';
import { sepolia } from 'viem/chains';

const config: WalletSdkConfig = {
  appId: import.meta.env.VITE_PRIVY_APP_ID,
  chains: [sepolia],                   // at least one chain required
  // rpcUrls: { 11155111: 'https://…' }, // optional per-chain RPC overrides (key = chainId)
  // privyConfig: { … },               // optional Privy client config
};

export default function App() {
  return (
    <WalletSdkProvider config={config}>
      <YourApp />
    </WalletSdkProvider>
  );
}
```

### 3.1 `WalletSdkConfig` type

```ts
interface WalletSdkConfig {
  appId: string;
  chains: [Chain, ...Chain[]];           // viem Chain objects; non-empty tuple
  rpcUrls?: Partial<Record<number, string>>; // chainId → RPC URL
  privyConfig?: PrivyClientConfigLike;
}

interface PrivyClientConfigLike {
  loginMethods?: Array<
    | 'wallet' | 'email' | 'sms'
    | 'google' | 'twitter' | 'discord' | 'github'
    | 'linkedin' | 'spotify' | 'instagram' | 'tiktok'
    | 'line' | 'twitch' | 'apple' | 'farcaster'
    | 'telegram' | 'passkey'
  >;
  embeddedWallets?: {
    ethereum?: { createOnLogin?: 'all-users' | 'users-without-wallets' | 'off' };
    solana?:   { createOnLogin?: 'all-users' | 'users-without-wallets' | 'off' };
    showWalletUIs?: boolean;
  };
  appearance?: Record<string, unknown>;
  [key: string]: unknown;
}
```

**Important behaviour**: The provider always ensures email/social (non-wallet) users receive an auto-created embedded Ethereum wallet. This default is preserved even when `privyConfig` is supplied.

---

## 4. Hooks Reference

### 4.1 `useWalletAuth()`

Auth and session state. No arguments.

#### Return value

```ts
{
  login:           () => void;               // open Privy login modal
  logout:          () => void;               // log out and clear session
  isReady:         boolean;                  // Privy SDK has initialised
  isAuthenticated: boolean;                  // user is logged in
  user:            PrivyUser | null;         // Privy user object (has .google, .wallet, .email, …)
  address:         `0x${string}` | undefined; // active wallet address (wagmi or embedded)
  hasWallet:       boolean;                  // isAuthenticated && !!address
}
```

#### Usage pattern

```tsx
import { useWalletAuth } from 'privy-wallet-sdk';

function AuthGate() {
  const { login, logout, isReady, isAuthenticated, address, hasWallet } = useWalletAuth();

  if (!isReady) return <p>Loading…</p>;
  if (!isAuthenticated) return <button onClick={login}>Log in</button>;

  return (
    <div>
      <p>Address: {address}</p>
      <p>Wallet ready: {hasWallet ? 'yes' : 'no'}</p>
      <button onClick={logout}>Log out</button>
    </div>
  );
}
```

#### Notes

- Always gate all wallet-dependent UI behind `isReady` first, then `isAuthenticated`.
- `hasWallet` is the correct guard before calling `deposit`, `fundAndDeposit`, or `signMessage`.
- `address` is `undefined` until the user is authenticated and a wallet is available.

---

### 4.2 `useVaultDeposit(options?)`

High-level deposit hook. Orchestrates both deposit paths with a single shared status model.

The `contract` field is **optional**:

- **Phase 1 (no contract)**: `deposit()` and `fundAndDeposit()` open Privy's funding modal and succeed once the wallet balance increases. No on-chain contract call is made.
- **Phase 2 (contract provided)**: `deposit()` calls the vault contract directly from the existing wallet balance; `fundAndDeposit()` funds first, then calls the vault contract.

#### Options

```ts
interface UseVaultDepositOptions {
  contract?: VaultContractConfig;  // omit for phase 1 (direct wallet funding)
}

interface VaultContractConfig {
  address:      `0x${string}`;  // contract address
  abi:          Abi;            // full or partial ABI including the target function (from viem)
  functionName: string;         // name of the function to call
  args?:        readonly unknown[]; // optional static arguments per call
}
```

#### Return value

```ts
{
  deposit:        (valueWei?: bigint, fundingOptions?: FundAccountOptions) => Promise<void>;
  fundAndDeposit: (valueWei?: bigint, fundingOptions?: FundAccountOptions) => Promise<void>;
  status:         VaultDepositStatus;
  result:         VaultDepositResult | null;
  hash:           `0x${string}` | undefined;
  receipt:        { status: 'success' | 'reverted'; blockNumber: bigint } | undefined;
  error:          string | null;
  reset:          () => void;
}
```

#### Status state machine

**Phase 1 (no contract)**
```
idle ──► funding ──► success
  └───────────────► error
```

**Phase 2 (contract provided)**
```
idle ──► funding ──► depositing ──► success
  │                  └─────────────► error
  └──────────────────────────────► error
```

| Value | Meaning |
|---|---|
| `idle` | No operation in progress |
| `funding` | Privy funding modal is open |
| `depositing` | Contract write in flight / waiting for wallet confirmation (phase 2 only) |
| `success` | Funding confirmed (phase 1) or receipt confirmed on-chain (phase 2) |
| `error` | Any phase failed |

#### Usage pattern — Phase 1 (direct wallet funding, no vault)

```tsx
import { useVaultDeposit } from 'privy-wallet-sdk';

function FundAccountUI() {
  const { fundAndDeposit, status, error, reset } = useVaultDeposit();
  // or: useVaultDeposit({})  — both are equivalent

  return (
    <div>
      <button
        onClick={() => fundAndDeposit(undefined, { asset: 'native-currency' })}
        disabled={status === 'funding'}
      >
        {status === 'funding' ? 'Funding…' : 'Fund with ETH'}
      </button>
      <button
        onClick={() => fundAndDeposit(undefined, { asset: 'USDC' })}
        disabled={status === 'funding'}
      >
        Fund with USDC
      </button>

      {status === 'success' && <p>Wallet funded!</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {status !== 'idle' && <button onClick={reset}>Reset</button>}
    </div>
  );
}
```

#### Usage pattern — Phase 2 (vault contract deposit)

```tsx
import { useVaultDeposit } from 'privy-wallet-sdk';
import type { VaultContractConfig } from 'privy-wallet-sdk';
import { parseEther } from 'viem';

const vaultContract: VaultContractConfig = {
  address: '0xYourContractAddress',
  abi: [{ name: 'deposit', type: 'function', stateMutability: 'payable', inputs: [], outputs: [] }],
  functionName: 'deposit',
};

function DepositUI() {
  const { deposit, fundAndDeposit, status, hash, receipt, error, reset } =
    useVaultDeposit({ contract: vaultContract });

  const busy = status === 'funding' || status === 'depositing';

  return (
    <div>
      <button onClick={() => deposit(parseEther('0.01'))} disabled={busy}>
        Deposit from wallet
      </button>
      <button onClick={() => fundAndDeposit(parseEther('0.01'))} disabled={busy}>
        {status === 'funding' ? 'Funding…' : 'Buy & Deposit'}
      </button>

      {hash && <p>Tx hash: {hash}</p>}
      {receipt && <p>Block: {receipt.blockNumber.toString()} ({receipt.status})</p>}
      {status === 'success' && <p>Deposit succeeded!</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {status !== 'idle' && <button onClick={reset}>Reset</button>}
    </div>
  );
}
```

#### `FundAccountOptions` (optional second arg to `fundAndDeposit`)

```ts
interface FundAccountOptions {
  chain?:                Chain;                                  // viem Chain
  amount?:               string;                                 // decimal string, e.g. '0.05'
  asset?:                'native-currency' | 'USDC' | { erc20: `0x${string}` };
  defaultFundingMethod?: 'card' | 'exchange' | 'wallet' | 'manual';
}
```

---

### 4.3 `useMessageSigning()`

EIP-191 message signing. No arguments.

#### Return value

```ts
{
  signMessage: (message: string, options?: SignMessageOptions) => Promise<`0x${string}` | undefined>;
  status:      SigningStatus;   // 'idle' | 'pending' | 'success' | 'error'
  signature:   `0x${string}` | undefined;  // last successful signature
  error:       string | null;
  reset:       () => void;
}
```

#### `SignMessageOptions`

```ts
interface SignMessageOptions {
  throwOnError?: boolean; // default: true — throws on failure; set false to suppress throw
}
```

#### Status states

| Value | Meaning |
|---|---|
| `idle` | No signing in progress |
| `pending` | Waiting for wallet confirmation |
| `success` | Signature obtained |
| `error` | Signing failed or rejected |

#### Usage pattern

```tsx
import { useMessageSigning } from 'privy-wallet-sdk';

function SignSection() {
  const { signMessage, status, signature, error } = useMessageSigning();

  const handleSign = async () => {
    try {
      const sig = await signMessage('Hello from my app');
      if (sig) {
        // send sig to your backend
        await fetch('/api/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signature: sig }),
        });
      }
    } catch (e) {
      // error already tracked in hook state; optionally handle here too
    }
  };

  return (
    <div>
      <button onClick={handleSign} disabled={status === 'pending'}>
        {status === 'pending' ? 'Signing…' : 'Sign Message'}
      </button>
      {signature && <p>Signature: {signature.slice(0, 20)}…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
```

#### Notes

- `signMessage` returns the `0x`-prefixed hex signature on success, or `undefined` on failure (when `throwOnError: false`).
- By default (`throwOnError: true`) it throws on failure; wrap in try/catch or use `throwOnError: false` for silent failure handling.
- The signature is compatible with backend `ecrecover` / `eth_accounts` / EIP-191 verification.

---

### 4.4 `useAccountFunding()` *(low-level)*

Opens Privy's funding modal standalone, without triggering a contract call afterward. Use when you want to offer a "top up wallet" feature separately from depositing.

#### Return value

```ts
{
  fundAccount: (overrideAddress?: `0x${string}`, options?: FundAccountOptions) => Promise<void>;
  status:      FundingStatus;  // 'idle' | 'pending' | 'success' | 'error'
  error:       string | null;
  reset:       () => void;
}
```

#### Notes

- `fundAccount()` without arguments uses the connected wallet address.
- Status transitions to `'success'` when the user **exits** the funding modal (not on on-chain confirmation, since MoonPay flows are async).
- If no wallet is connected and no address is passed, status becomes `'error'`.

---

## 5. Type Definitions Summary

All types are importable from `privy-wallet-sdk`:

```ts
import type {
  WalletSdkConfig,
  PrivyClientConfigLike,
  VaultContractConfig,
  VaultDepositStatus,    // 'idle' | 'funding' | 'depositing' | 'success' | 'error'
  VaultDepositResult,    // { hash?, receipt?, error? }
  FundingStatus,         // 'idle' | 'pending' | 'success' | 'error'
  SigningStatus,         // 'idle' | 'pending' | 'success' | 'error'
  SigningResult,         // { signature?, error? }
  SignMessageOptions,    // { throwOnError?: boolean }
  UseVaultDepositOptions,
  FundAccountOptions,
} from 'privy-wallet-sdk';

import { WalletSdkError } from 'privy-wallet-sdk';
// WalletSdkError extends Error with optional .code: string
```

---

## 6. Error Handling

- All hooks expose an `error: string | null` field — surface this in your UI.
- All hooks expose a `reset()` function — call it to return to `'idle'` and clear error state before retrying.
- `useMessageSigning().signMessage()` throws by default; pass `{ throwOnError: false }` to suppress throwing.
- The SDK normalises all error types to strings in the `error` field (no need to check instanceof).

---

## 7. Common Patterns

### Conditional rendering based on auth state

```tsx
const { isReady, isAuthenticated, hasWallet } = useWalletAuth();

if (!isReady) return <Spinner />;
if (!isAuthenticated) return <LoginPrompt />;
if (!hasWallet) return <p>Creating wallet…</p>;
return <MainApp />;
```

### Disabling buttons during async operations

```tsx
// Vault deposit
const busy = vault.status === 'funding' || vault.status === 'depositing';
<button disabled={busy}>…</button>

// Signing
<button disabled={signing.status === 'pending'}>…</button>

// Account funding
<button disabled={funding.status === 'pending'}>…</button>
```

### Sign → send to backend (common pattern)

```tsx
const { signMessage } = useMessageSigning();
const { address } = useWalletAuth();

const handleSubmit = async (payload: string) => {
  const signature = await signMessage(payload);
  await fetch('/api/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, message: payload, signature }),
  });
};
```

### Deposit with amount input

```tsx
import { parseEther } from 'viem';  // viem is allowed in consumer code

const [amountEth, setAmountEth] = useState('0.01');
const valueWei = (() => {
  try { return parseEther(amountEth || '0'); } catch { return undefined; }
})();

vault.deposit(valueWei);
```

---

## 8. Constraints & Anti-Patterns

| Do | Don't |
|---|---|
| Import hooks/types from `privy-wallet-sdk` | Import from `wagmi`, `@privy-io/react-auth`, `@privy-io/wagmi` |
| Use `isReady` guard before rendering auth-dependent UI | Render wallet UI before `isReady` is true |
| Use `hasWallet` guard before calling deposit/sign | Assume address is available immediately after login |
| Call `reset()` before a retry | Re-call `deposit`/`signMessage` while status is not `idle` |
| Use `parseEther` from `viem` for amount conversion | Pass raw string amounts as bigint |
| Define `VaultContractConfig` outside the component (stable reference) | Define it inline inside render (causes unnecessary re-renders) |
| Use `vault.error` string for error display | Inspect `vault.result.error` directly unless you need the Error object |

---

## 9. Complete Minimal Example

### Phase 1 — Direct wallet funding (no vault)

```tsx
// main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { WalletSdkProvider } from 'privy-wallet-sdk';
import { sepolia } from 'viem/chains';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <WalletSdkProvider config={{ appId: import.meta.env.VITE_PRIVY_APP_ID, chains: [sepolia] }}>
    <App />
  </WalletSdkProvider>
);
```

```tsx
// App.tsx — Phase 1: fund the embedded wallet directly, no vault contract needed
import { useWalletAuth, useVaultDeposit, useMessageSigning } from 'privy-wallet-sdk';

export default function App() {
  const auth = useWalletAuth();
  const funding = useVaultDeposit();  // no contract → phase 1 mode
  const signing = useMessageSigning();

  if (!auth.isReady) return <p>Loading…</p>;

  if (!auth.isAuthenticated) {
    return <button onClick={auth.login}>Log in</button>;
  }

  return (
    <div>
      <p>Connected: {auth.address}</p>
      <button onClick={auth.logout}>Log out</button>

      <hr />

      <button
        onClick={() => funding.fundAndDeposit(undefined, { asset: 'native-currency' })}
        disabled={funding.status === 'funding'}
      >
        {funding.status === 'funding' ? 'Funding…' : 'Fund with ETH'}
      </button>
      <button
        onClick={() => funding.fundAndDeposit(undefined, { asset: 'USDC' })}
        disabled={funding.status === 'funding'}
      >
        Fund with USDC
      </button>
      {funding.status === 'success' && <p>Wallet funded!</p>}
      {funding.error && <p style={{ color: 'red' }}>{funding.error}</p>}

      <hr />

      <button
        onClick={() => signing.signMessage('hello world')}
        disabled={signing.status === 'pending'}
      >
        Sign Message
      </button>
      {signing.signature && <p>Sig: {signing.signature.slice(0, 20)}…</p>}
      {signing.error && <p style={{ color: 'red' }}>{signing.error}</p>}
    </div>
  );
}
```

### Phase 2 — Vault contract deposit (future)

When a vault contract is available, pass it to `useVaultDeposit` to unlock direct on-chain deposits:

```tsx
import { useVaultDeposit } from 'privy-wallet-sdk';
import type { VaultContractConfig } from 'privy-wallet-sdk';
import { parseEther } from 'viem';

// Define outside component for a stable reference.
const vaultContract: VaultContractConfig = {
  address: import.meta.env.VITE_DEPOSIT_CONTRACT_ADDRESS as `0x${string}`,
  abi: [{ name: 'deposit', type: 'function', stateMutability: 'payable', inputs: [], outputs: [] }],
  functionName: 'deposit',
};

// Inside your component:
const vault = useVaultDeposit({ contract: vaultContract });

// deposit() calls the contract from existing balance;
// fundAndDeposit() funds the wallet first, then calls the contract.
vault.deposit(parseEther('0.01'));
vault.fundAndDeposit(parseEther('0.01'));
```
