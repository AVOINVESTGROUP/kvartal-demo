# IREPN Property Identity contract

`Bep721PropertyIdentityToken` is a non-upgradeable, non-tradable BEP-721-compatible registry token.

- Partner Corporate Safe owns the token.
- IREPN Registry/Admin Safe holds all contract administration roles.
- Holder transfers and approvals always revert.
- On-chain records contain only stable reference and evidence/version hashes.
- Deployment supports BNB Smart Chain Mainnet (chain `56`) and Testnet (chain `97`). Mainnet requires the explicit write flag and an owner-approved change ticket.

Local verification:

```bash
pnpm --filter @kvartal/contracts test
```

Browser deployment through platform-admin is preferred because the private key never reaches the application. The backup Mainnet CLI command requires `BSC_MAINNET_DEPLOYER_PRIVATE_KEY`, `IREPN_REGISTRY_ADMIN_SAFE_ADDRESS`, `PROPERTY_IDENTITY_MAINNET_WRITE_ENABLED=true` and `PROPERTY_IDENTITY_MAINNET_CHANGE_TICKET`; never commit these values.
