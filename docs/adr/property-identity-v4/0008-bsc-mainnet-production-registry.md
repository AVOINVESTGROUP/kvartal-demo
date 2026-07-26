# ADR 0008 — BSC Mainnet is the Property Identity production registry

Date: 2026-07-26  
Status: accepted by product owner

## Decision

The working Property Identity Web3 registry uses BNB Smart Chain Mainnet (`chainId = 56`). BSC Testnet is only a development environment and cannot be presented as completion of the product.

Mainnet writes require all of the following:

- `PROPERTY_IDENTITY_CHAIN_ID=56`;
- `PROPERTY_IDENTITY_MAINNET_WRITE_ENABLED=true`;
- an explicit `PROPERTY_IDENTITY_MAINNET_CHANGE_TICKET` tied to the owner decision;
- an owner-controlled Registry/Admin Safe with at least two owners and threshold 2;
- successful on-chain contract verification before registry activation;
- wallet confirmation for every deployment and Safe execution;
- reconciliation before a token is shown as verified.

The application never stores a private key or seed phrase. Browser deployment and execution use the owner's EIP-1193 wallet. The CLI deployment path is an emergency/operator fallback only.

## Environment fact

At the time of this decision, GCP contains only project `kvartal-dev`; no separately provisioned KVARTAL production project exists. The Mainnet software may be released to the current owner console, but this does not silently rename or claim the whole GCP project as a fully separated production environment. A separate production-infrastructure migration remains independent work.
