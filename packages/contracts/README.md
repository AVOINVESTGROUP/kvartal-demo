# Fixer.guru Property Identity Registry contract

`Bep721PropertyIdentityToken` is a non-upgradeable, non-tradable BEP-721-compatible registry for one canonical physical-property identity.

- Every token is minted to the single Fixer.guru platform registry wallet and remains in platform custody.
- The same platform wallet holds all registry administration roles.
- Partner agencies never own or transfer the identity token. Their verified corporate BSC wallets are recorded as representation attestations for the token.
- Holder transfers and approvals always revert.
- On-chain records contain only stable references, canonical/evidence hashes, representation hashes and lifecycle status; private documents remain off-chain.
- The platform signer reads its private key only from Google Secret Manager. No key is accepted from a browser, environment file, CLI argument or repository file.
- BNB Smart Chain Mainnet is chain `56`; Testnet is chain `97`. Mainnet writes remain blocked unless the explicit release flag and change ticket are configured.

Local verification:

```bash
pnpm --filter @kvartal/contracts test
```

Deployment is initiated by the sole platform owner from `platform-admin`. `platform-api` accepts only the approved compiled artifact hashes, deploys through the Google Secret Manager-backed signer, waits for confirmations, verifies runtime bytecode and every required role, and then records the deployment. Recovery registration exists only for a successfully deployed but not yet recorded approved contract.
