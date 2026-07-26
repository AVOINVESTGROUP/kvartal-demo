import { describe, expect, it } from "vitest";
import { buildWeb3Readiness } from "./property-identity-web3.js";

const base = {
  chainId: 56,
  production: true,
  writesAllowed: true,
  safeTransactionServiceConfigured: true,
  activeRegistryContract: { contractAddress: "0x0000000000000000000000000000000000000001", registryAdminSafeAddress: "0x0000000000000000000000000000000000000002" },
  activeCorporateWalletCount: 1,
  eligibleProfileCount: 1,
  reconciledActiveTokenCount: 0,
};

describe("Property Identity Web3 readiness", () => {
  it("reports the first real mint as the next action when infrastructure is ready", () => {
    expect(buildWeb3Readiness(base)).toMatchObject({
      mainnetSelected: true,
      readyForMint: true,
      firstTokenLive: false,
      nextAction: "MINT_AND_RECONCILE_FIRST_TOKEN",
    });
  });

  it("does not claim readiness when Safe Transaction Service is absent", () => {
    expect(buildWeb3Readiness({ ...base, safeTransactionServiceConfigured: false })).toMatchObject({
      readyForMint: false,
      nextAction: "CONFIGURE_SAFE_TRANSACTION_SERVICE",
    });
  });

  it("claims a live registry only after an active token is reconciled", () => {
    expect(buildWeb3Readiness({ ...base, reconciledActiveTokenCount: 1 })).toMatchObject({
      readyForMint: true,
      firstTokenLive: true,
      nextAction: "FIRST_TOKEN_LIVE",
    });
  });
});
