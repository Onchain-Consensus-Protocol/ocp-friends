# OCP/Friends

OCP/Friends is an independent, invite-only Vault product built on the OCP settlement model. A creator opens a Vault, invites up to 100 wallets, and chooses one of two resolution methods:

- **OCP Core Rules:** a strict majority of staked principal determines YES or NO; otherwise the result is INVALID.
- **Creator Resolved:** the creator submits YES, NO, or INVALID after staking ends. If the creator misses the deadline, anyone can finalize INVALID.

An empty Vault always settles as INVALID. INVALID returns each participant's full principal. Private Vault has no donation mechanism.

## Repository

- `contracts/`: standalone `PrivateVault` and `PrivateVaultFactory`, Foundry tests, and deployment script.
- `frontend/`: bilingual OCP/Friends web app for rules, creation, browsing wallet-accessible Vaults, and Vault participation.

## Local development

```bash
git submodule update --init --recursive
cd contracts
forge test

cd ../frontend
cp .env.example .env.local
npm install
npm run dev
```

## Frontend configuration

```dotenv
VITE_PRIVATE_VAULT_FACTORY_ADDRESS=0x...
VITE_DEPOSIT_TOKEN_ADDRESS=0x...
VITE_CHAIN_ID=8453
VITE_RPC_URL=https://mainnet.base.org
VITE_EXPLORER=https://basescan.org
```

The production frontend must use a deployed `PrivateVaultFactory` and a stake token on the same network.

## Contract deployment

```bash
cd contracts
export PRIVATE_KEY=0x...
forge script script/DeployPrivateVaultFactory.s.sol:DeployPrivateVaultFactoryScript \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --verify
```

Never commit private keys or deployment secrets.

## Privacy boundary

The UI checks the connected wallet against each Vault's onchain allowlist before rendering details. This prevents uninvited users from entering through the product interface, but public blockchain data remains publicly queryable.

## Intended site

`https://friends.ocp-protocol.org`
