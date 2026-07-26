import { createHash } from "node:crypto";
import {
  createPublicClient,
  encodeFunctionData,
  getAddress,
  hashTypedData,
  http,
  isAddress,
  keccak256,
  stringToHex,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";

export type SupportedChainId = 97 | 56;

export type ChainConfig = Readonly<{
  chainId: SupportedChainId;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  production: boolean;
}>;

export function readChainConfig(env: NodeJS.ProcessEnv = process.env): ChainConfig {
  const chainId = Number(env.PROPERTY_IDENTITY_CHAIN_ID ?? 97);
  if (chainId !== 97 && chainId !== 56) throw new Error("WEB3_CHAIN_UNSUPPORTED");
  const production = chainId === 56;
  if (production && env.PROPERTY_IDENTITY_MAINNET_WRITE_ENABLED === "true") {
    if ((env.PROPERTY_IDENTITY_MAINNET_CHANGE_TICKET?.trim().length ?? 0) < 8) throw new Error("WEB3_MAINNET_CHANGE_TICKET_REQUIRED");
  }
  return Object.freeze({
    chainId,
    name: production ? "BNB Smart Chain Mainnet" : "BNB Smart Chain Testnet",
    rpcUrl: env.PROPERTY_IDENTITY_RPC_URL?.trim() || (production ? "https://bsc-dataseed.bnbchain.org" : "https://bsc-testnet-dataseed.bnbchain.org"),
    explorerUrl: production ? "https://bscscan.com" : "https://testnet.bscscan.com",
    production,
  });
}

export function assertChainWriteAllowed(config: ChainConfig, env: NodeJS.ProcessEnv = process.env) {
  if (config.production && env.PROPERTY_IDENTITY_MAINNET_WRITE_ENABLED !== "true") throw new Error("WEB3_MAINNET_WRITE_DISABLED");
}

export function normalizeAddress(value: string): Address {
  if (!isAddress(value, { strict: false })) throw new Error("WEB3_ADDRESS_INVALID");
  return getAddress(value);
}

export function deterministicTokenId(stablePropertyIdentityId: string): bigint {
  const normalized = stablePropertyIdentityId.normalize("NFKC").trim();
  if (!normalized) throw new Error("PROPERTY_IDENTITY_ID_REQUIRED");
  return BigInt(`0x${createHash("sha256").update(`IREPN\0${normalized}`, "utf8").digest("hex")}`);
}

export type PublicTokenPayload = Readonly<{
  propertyReferenceHash: Hex;
  canonicalVersionHash: Hex;
  evidencePackageHash: Hex;
}>;

export function buildPublicTokenPayload(input: { stablePropertyIdentityId: string; canonicalVersionHash: string; evidencePackageHash: string }): PublicTokenPayload {
  const bytes32 = (value: string, code: string) => {
    if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(code);
    return value.toLowerCase() as Hex;
  };
  return Object.freeze({
    propertyReferenceHash: keccak256(stringToHex(`IREPN:${input.stablePropertyIdentityId.normalize("NFKC").trim()}`)),
    canonicalVersionHash: bytes32(input.canonicalVersionHash, "CANONICAL_VERSION_HASH_INVALID"),
    evidencePackageHash: bytes32(input.evidencePackageHash, "EVIDENCE_PACKAGE_HASH_INVALID"),
  });
}

export function corporateWalletChallenge(input: { chainId: SupportedChainId; safeAddress: string; organizationId: string; nonce: string; expiresAt: Date }) {
  const message = {
    safeAddress: normalizeAddress(input.safeAddress),
    organizationId: input.organizationId,
    nonce: input.nonce,
    expiresAt: BigInt(Math.floor(input.expiresAt.getTime() / 1000)),
    purpose: "BIND_CORPORATE_SAFE",
  } as const;
  const typedData = {
    domain: { name: "KVARTAL Property Identity Registry", version: "1", chainId: input.chainId },
    types: {
      CorporateWalletBinding: [
        { name: "safeAddress", type: "address" },
        { name: "organizationId", type: "string" },
        { name: "nonce", type: "string" },
        { name: "expiresAt", type: "uint256" },
        { name: "purpose", type: "string" },
      ],
    },
    primaryType: "CorporateWalletBinding" as const,
    message,
  };
  return Object.freeze({ typedData, messageHash: hashTypedData(typedData) });
}

export type SafeState = Readonly<{ address: Address; owners: readonly Address[]; threshold: number; version: string | null }>;

export interface CorporateWalletAdapter {
  readSafe(address: string): Promise<SafeState>;
  verifyEip1271(address: string, messageHash: Hex, signature: Hex): Promise<boolean>;
}

const safeAbi = [
  { type: "function", name: "getOwners", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address[]" }] },
  { type: "function", name: "getThreshold", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "VERSION", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { type: "function", name: "isValidSignature", stateMutability: "view", inputs: [{ name: "hash", type: "bytes32" }, { name: "signature", type: "bytes" }], outputs: [{ name: "", type: "bytes4" }] },
] as const;

export class SafeRpcAdapter implements CorporateWalletAdapter {
  private readonly client: PublicClient;

  constructor(rpcUrl: string, client?: PublicClient) {
    this.client = client ?? createPublicClient({ transport: http(rpcUrl) });
  }

  async readSafe(value: string): Promise<SafeState> {
    const address = normalizeAddress(value);
    const [owners, threshold, version] = await Promise.all([
      this.client.readContract({ address, abi: safeAbi, functionName: "getOwners" }),
      this.client.readContract({ address, abi: safeAbi, functionName: "getThreshold" }),
      this.client.readContract({ address, abi: safeAbi, functionName: "VERSION" }).catch(() => null),
    ]);
    if (threshold < 1n || threshold > BigInt(owners.length)) throw new Error("SAFE_THRESHOLD_INVALID");
    return Object.freeze({ address, owners: Object.freeze(owners.map(getAddress)), threshold: Number(threshold), version });
  }

  async verifyEip1271(value: string, messageHash: Hex, signature: Hex) {
    const result = await this.client.readContract({ address: normalizeAddress(value), abi: safeAbi, functionName: "isValidSignature", args: [messageHash, signature] });
    return result.toLowerCase() === "0x1626ba7e";
  }
}

const registryAbi = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { type: "function", name: "supportsInterface", stateMutability: "view", inputs: [{ name: "interfaceId", type: "bytes4" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "hasRole", stateMutability: "view", inputs: [{ name: "role", type: "bytes32" }, { name: "account", type: "address" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "ownerOf", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "identityRecord", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "propertyReferenceHash", type: "bytes32" }, { name: "canonicalVersionHash", type: "bytes32" }, { name: "evidencePackageHash", type: "bytes32" }, { name: "status", type: "uint8" }] },
  { type: "function", name: "mintIdentity", inputs: [{ name: "to", type: "address" }, { name: "tokenId", type: "uint256" }, { name: "propertyReferenceHash", type: "bytes32" }, { name: "canonicalVersionHash", type: "bytes32" }, { name: "evidencePackageHash", type: "bytes32" }, { name: "uri", type: "string" }], outputs: [] },
  { type: "function", name: "updateHashes", inputs: [{ name: "tokenId", type: "uint256" }, { name: "canonicalVersionHash", type: "bytes32" }, { name: "evidencePackageHash", type: "bytes32" }], outputs: [] },
  { type: "function", name: "suspend", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [] },
  { type: "function", name: "unsuspend", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [] },
  { type: "function", name: "revoke", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [] },
  { type: "function", name: "registryReassign", inputs: [{ name: "tokenId", type: "uint256" }, { name: "to", type: "address" }], outputs: [] },
] as const;

export class RegistryRpcAdapter {
  private readonly client: PublicClient;

  constructor(rpcUrl: string, client?: PublicClient) {
    this.client = client ?? createPublicClient({ transport: http(rpcUrl) });
  }

  async verifyDeployment(input: { contractAddress: string; deploymentTxHash: Hex; registryAdminSafe: string }) {
    const contractAddress = normalizeAddress(input.contractAddress);
    const registryAdminSafe = normalizeAddress(input.registryAdminSafe);
    const [bytecode, receipt] = await Promise.all([
      this.client.getBytecode({ address: contractAddress }),
      this.client.getTransactionReceipt({ hash: input.deploymentTxHash }),
    ]);
    if (!bytecode || bytecode === "0x") throw new Error("REGISTRY_CONTRACT_BYTECODE_MISSING");
    if (receipt.status !== "success") throw new Error("REGISTRY_DEPLOYMENT_TRANSACTION_FAILED");
    if (!receipt.contractAddress || getAddress(receipt.contractAddress) !== contractAddress) throw new Error("REGISTRY_DEPLOYMENT_ADDRESS_MISMATCH");

    const roles = [
      `0x${"00".repeat(32)}`,
      keccak256(stringToHex("ISSUER_ROLE")),
      keccak256(stringToHex("VERSION_ROLE")),
      keccak256(stringToHex("SUSPENDER_ROLE")),
      keccak256(stringToHex("REVOKER_ROLE")),
      keccak256(stringToHex("REASSIGNER_ROLE")),
      keccak256(stringToHex("PAUSER_ROLE")),
    ] as const;
    const [name, symbol, supportsErc721, ...roleChecks] = await Promise.all([
      this.client.readContract({ address: contractAddress, abi: registryAbi, functionName: "name" }),
      this.client.readContract({ address: contractAddress, abi: registryAbi, functionName: "symbol" }),
      this.client.readContract({ address: contractAddress, abi: registryAbi, functionName: "supportsInterface", args: ["0x80ac58cd"] }),
      ...roles.map((role) => this.client.readContract({ address: contractAddress, abi: registryAbi, functionName: "hasRole", args: [role, registryAdminSafe] })),
    ]);
    if (name !== "IREPN Property Identity" || symbol !== "IREPN-ID" || supportsErc721 !== true) throw new Error("REGISTRY_CONTRACT_INTERFACE_INVALID");
    if (roleChecks.some((granted) => granted !== true)) throw new Error("REGISTRY_ADMIN_SAFE_ROLES_MISSING");
    return Object.freeze({
      contractAddress,
      registryAdminSafe,
      deploymentTxHash: receipt.transactionHash,
      deploymentBlockNumber: receipt.blockNumber,
      bytecodeHash: keccak256(bytecode),
      name,
      symbol,
      rolesVerified: roles.length,
    });
  }

  async readToken(contractAddress: string, tokenId: bigint) {
    const address = normalizeAddress(contractAddress);
    const [ownerResult, recordResult, blockNumber] = await Promise.all([
      this.client.readContract({ address, abi: registryAbi, functionName: "ownerOf", args: [tokenId] }),
      this.client.readContract({ address, abi: registryAbi, functionName: "identityRecord", args: [tokenId] }),
      this.client.getBlockNumber(),
    ]);
    const owner = ownerResult as Address;
    const record = recordResult as readonly [Hex, Hex, Hex, number];
    return Object.freeze({
      owner: getAddress(owner),
      propertyReferenceHash: record[0],
      canonicalVersionHash: record[1],
      evidencePackageHash: record[2],
      status: Number(record[3]),
      blockNumber,
    });
  }
}

export function encodeRegistryOperation(operation: "MINT" | "UPDATE_HASHES" | "SUSPEND" | "UNSUSPEND" | "REVOKE" | "REASSIGN", payload: Record<string, unknown>): Hex {
  const tokenId = BigInt(String(payload.tokenId));
  if (operation === "MINT") return encodeFunctionData({ abi: registryAbi, functionName: "mintIdentity", args: [normalizeAddress(String(payload.to)), tokenId, String(payload.propertyReferenceHash) as Hex, String(payload.canonicalVersionHash) as Hex, String(payload.evidencePackageHash) as Hex, String(payload.uri ?? "")] });
  if (operation === "UPDATE_HASHES") return encodeFunctionData({ abi: registryAbi, functionName: "updateHashes", args: [tokenId, String(payload.canonicalVersionHash) as Hex, String(payload.evidencePackageHash) as Hex] });
  if (operation === "REASSIGN") return encodeFunctionData({ abi: registryAbi, functionName: "registryReassign", args: [tokenId, normalizeAddress(String(payload.to))] });
  const functionName = operation === "SUSPEND" ? "suspend" : operation === "UNSUSPEND" ? "unsuspend" : "revoke";
  return encodeFunctionData({ abi: registryAbi, functionName, args: [tokenId] });
}
