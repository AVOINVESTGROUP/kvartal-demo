import { createPublicClient, createWalletClient, defineChain, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

async function metadataAccessToken() {
  const response = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", {
    headers: { "Metadata-Flavor": "Google" },
  });
  if (!response.ok) throw new Error("PLATFORM_SIGNER_ADC_UNAVAILABLE");
  const payload = await response.json() as { access_token?: string };
  if (!payload.access_token) throw new Error("PLATFORM_SIGNER_ADC_UNAVAILABLE");
  return payload.access_token;
}

export async function readPlatformSignerSecret(secretResourceName: string) {
  if (!/^projects\/[^/]+\/secrets\/[^/]+\/versions\/[^/]+$/.test(secretResourceName)) throw new Error("PLATFORM_SIGNER_SECRET_RESOURCE_INVALID");
  const token = await metadataAccessToken();
  const response = await fetch(`https://secretmanager.googleapis.com/v1/${secretResourceName}:access`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("PLATFORM_SIGNER_SECRET_ACCESS_DENIED");
  const payload = await response.json() as { payload?: { data?: string } };
  const value = payload.payload?.data ? Buffer.from(payload.payload.data, "base64").toString("utf8").trim() : "";
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error("PLATFORM_SIGNER_SECRET_FORMAT_INVALID");
  return value as Hex;
}

export async function resolvePlatformSigner(input: { secretResourceName: string; expectedAddress: string; chainId: number; rpcUrl: string }) {
  const privateKey = await readPlatformSignerSecret(input.secretResourceName);
  const account = privateKeyToAccount(privateKey);
  if (account.address.toLowerCase() !== input.expectedAddress.toLowerCase()) throw new Error("PLATFORM_SIGNER_ADDRESS_MISMATCH");
  const chain = defineChain({ id: input.chainId, name: input.chainId === 56 ? "BNB Smart Chain" : "BNB Smart Chain Testnet", nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 }, rpcUrls: { default: { http: [input.rpcUrl] } } });
  return {
    address: account.address,
    walletClient: createWalletClient({ account, chain, transport: http(input.rpcUrl) }),
    publicClient: createPublicClient({ chain, transport: http(input.rpcUrl) }),
  };
}
