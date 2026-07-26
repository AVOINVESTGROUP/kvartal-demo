# IREPN Property Identity contract

`Bep721PropertyIdentityToken` is a non-upgradeable, non-tradable BEP-721-compatible registry token.

- Partner Corporate Safe owns the token.
- IREPN Registry/Admin Safe holds all contract administration roles.
- Holder transfers and approvals always revert.
- On-chain records contain only stable reference and evidence/version hashes.
- The included deployment command is restricted to BNB Smart Chain Testnet (chain `97`). There is intentionally no Mainnet deployment command.

Local verification:

```bash
pnpm --filter @kvartal/contracts test
```

Testnet deployment requires `BSC_TESTNET_DEPLOYER_PRIVATE_KEY` and `IREPN_REGISTRY_ADMIN_SAFE_ADDRESS` from Secret Manager or an ephemeral operator environment. Never commit them.
