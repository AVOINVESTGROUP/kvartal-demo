# ADR 0008 — BSC Mainnet is the Property Identity production registry

Date: 2026-07-26  
Status: accepted; governance requirements superseded by ADR 0009

## Decision

The working Property Identity Web3 registry uses BNB Smart Chain Mainnet (`chainId = 56`). BSC Testnet is only a development environment and cannot be presented as completion of the product.

Mainnet writes require all of the following:

- `PROPERTY_IDENTITY_CHAIN_ID=56`;
- `PROPERTY_IDENTITY_MAINNET_WRITE_ENABLED=true`;
- an explicit `PROPERTY_IDENTITY_MAINNET_CHANGE_TICKET` tied to the owner decision;
- the single platform administration wallet bound to `office@integrayachtsuae.com`;
- successful on-chain contract verification before registry activation;
- dedicated server-side signing whose secret is read only from Google Secret Manager by the platform signer service account;
- reconciliation before a token is shown as verified.

The private key is never returned to a browser, stored in PostgreSQL, committed to Git or logged. It is stored only in Google Secret Manager and exposed to the dedicated signer runtime identity. Partner corporate-wallet keys remain exclusively with the partner organisations.

## Environment fact

At the time of this decision, GCP contains only project `kvartal-dev`; no separately provisioned KVARTAL production project exists. The Mainnet software may be released to the current owner console, but this does not silently rename or claim the whole GCP project as a fully separated production environment. A separate production-infrastructure migration remains independent work.
