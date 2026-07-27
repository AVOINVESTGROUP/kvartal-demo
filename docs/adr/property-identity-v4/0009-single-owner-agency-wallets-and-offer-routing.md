# ADR 0009 — Single platform owner, agency wallets and offer-bound routing

Date: 2026-07-27  
Status: accepted by product owner; supersedes all conflicting Safe, manual-review and owner-office routing decisions

## Decision

### Platform control

- The only platform owner is `office@integrayachtsuae.com`.
- One BSC administration wallet is bound to that account and owns/administers the Property Identity contract.
- Platform signer material is stored only in Google Secret Manager and is readable only by a dedicated signer service account.
- Safe 2-of-N, multiple platform-owner wallets and email-list owner bootstrap are not part of the product architecture.

### Partner corporate wallets

- Every partner organisation connects and proves control of its own corporate BSC wallet in `partner-admin`.
- The platform never receives or stores agency private keys or seed phrases.
- The canonical BEP-721 token identifies one physical property. It does not identify the legal owner and is not duplicated for each agency.
- The contract stores separate representation records from one token to each authorised agency wallet, including status, validity and evidence-package hash.

### Publication and evidence

- Publishing an object is the agency's declaration that it has authority to represent the property and that supporting documents are attached.
- The platform validates document presence, uniqueness, schema integrity and Web3 consistency. It does not manually approve an ordinary publication.
- Platform audit may dispute, suspend or revoke a representation after publication. Every such action is reasoned and audited.
- A new physical property creates one canonical object, one IREPN ID and one token. An exact match creates only a new agency representation, offer and publication grant.

### Requests and deal flow

- Every request about a property targets one active `PartnerOffer`, never a bare property or caller-supplied seller organisation.
- The backend derives the seller organisation, seller office and representation right from the offer.
- The initiating organisation/office represents the buyer. The offer organisation/office represents the seller.
- Other agencies representing the same physical property do not receive that request.
- Deal Room creation preserves the selected offer, representation, buyer-side client intent and both organisation/office scopes.

## Required invariants

```text
one physical property
  -> one PropertyObject
  -> one PropertyIdentityProfile / IREPN ID
  -> one BEP-721 token
  -> many document-backed agency representations
  -> many agency offers
  -> offer-bound requests and deal rooms
```

No Mainnet writes are permitted until the schema, API, contract, reconciliation and authenticated E2E tests enforce these invariants.
