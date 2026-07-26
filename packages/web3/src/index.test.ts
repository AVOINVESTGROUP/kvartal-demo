import { describe, expect, it } from "vitest";
import { assertChainWriteAllowed, buildPublicTokenPayload, corporateWalletChallenge, deterministicTokenId, encodeRegistryOperation, normalizeAddress, readChainConfig } from "./index.js";

describe("Property Identity Web3 domain", () => {
  it("uses the official BSC testnet by default and blocks mainnet writes", () => {
    expect(readChainConfig({}).chainId).toBe(97);
    const mainnet = readChainConfig({ PROPERTY_IDENTITY_CHAIN_ID: "56" });
    expect(() => assertChainWriteAllowed(mainnet, {})).toThrow("WEB3_MAINNET_WRITE_DISABLED");
  });

  it("derives stable uint256 token ids without exposing property data", () => {
    expect(deterministicTokenId("IREPN-123")).toBe(deterministicTokenId("IREPN-123"));
    expect(deterministicTokenId("IREPN-123")).not.toBe(deterministicTokenId("IREPN-124"));
  });

  it("accepts only bytes32 public hashes", () => {
    const payload = buildPublicTokenPayload({ stablePropertyIdentityId: "IREPN-123", canonicalVersionHash: `0x${"11".repeat(32)}`, evidencePackageHash: `0x${"22".repeat(32)}` });
    expect(payload.propertyReferenceHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(JSON.stringify(payload)).not.toContain("address");
  });

  it("normalizes wallet addresses and encodes registry-safe calls", () => {
    const address = normalizeAddress("0x0000000000000000000000000000000000000001");
    const data = encodeRegistryOperation("SUSPEND", { tokenId: "42" });
    expect(address).toBe("0x0000000000000000000000000000000000000001");
    expect(data).toMatch(/^0x[0-9a-f]+$/);
  });

  it("binds Safe challenges to chain, organization, nonce and expiry", () => {
    const challenge = corporateWalletChallenge({ chainId: 97, safeAddress: "0x0000000000000000000000000000000000000001", organizationId: "org-1", nonce: "nonce-1", expiresAt: new Date("2026-07-26T12:00:00Z") });
    expect(challenge.messageHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(challenge.typedData.message.organizationId).toBe("org-1");
  });
});
