import { describe, expect, it } from "vitest";
import { buildWeb3Readiness } from "./property-identity-web3.js";

const base = {
  chainId: 56,
  production: true,
  writesAllowed: true,
  activePlatformWallet: { walletAddress: "0x0000000000000000000000000000000000000002" },
  activeRegistryContract: { contractAddress: "0x0000000000000000000000000000000000000001", platformRegistryWalletId: "wallet-1" },
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

  it("does not claim readiness when the platform registry wallet is absent", () => {
    expect(buildWeb3Readiness({ ...base, activePlatformWallet: null })).toMatchObject({
      readyForMint: false,
      nextAction: "BIND_PLATFORM_REGISTRY_WALLET",
    });
  });

  it("allows a fully configured testnet to run the dev E2E", () => {
    expect(buildWeb3Readiness({ ...base, chainId: 97, production: false })).toMatchObject({
      mainnetSelected: false,
      readyForMint: true,
      nextAction: "MINT_AND_RECONCILE_FIRST_TOKEN",
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
