# app

This is a Vite app containing:

- Tailwind CSS setup for styling
- Useful wallet UI elements setup using [@solana/web3.js](https://www.npmjs.com/package/@solana/web3.js)

## Getting Started

### Installation

#### Download the template

```shell
pnpm create solana-dapp@latest -t gh:solana-foundation/templates/web3js/app
```

#### Install Dependencies

```shell
pnpm install
```

### Environment

Create `app/.env` (or copy from `app/.env.example`) and set:

```shell
VITE_API_ENDPOINT=http://localhost:7777
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
```

### Start the web app

```shell
pnpm dev
```
