const { createHash } = require("node:crypto");
const { ethers, network, artifacts } = require("hardhat");

async function main() {
  const chainId = Number(network.config.chainId);
  if (chainId !== 97 && chainId !== 56) throw new Error("DEPLOYMENT_RESTRICTED_TO_BSC");
  if (chainId === 56) {
    if (process.env.PROPERTY_IDENTITY_MAINNET_WRITE_ENABLED !== "true") throw new Error("WEB3_MAINNET_WRITE_DISABLED");
    if ((process.env.PROPERTY_IDENTITY_MAINNET_CHANGE_TICKET || "").trim().length < 8) throw new Error("WEB3_MAINNET_CHANGE_TICKET_REQUIRED");
    if (!process.env.BSC_MAINNET_DEPLOYER_PRIVATE_KEY) throw new Error("BSC_MAINNET_DEPLOYER_PRIVATE_KEY_REQUIRED");
  } else if (!process.env.BSC_TESTNET_DEPLOYER_PRIVATE_KEY) throw new Error("BSC_TESTNET_DEPLOYER_PRIVATE_KEY_REQUIRED");

  const registryAdminSafe = process.env.IREPN_REGISTRY_ADMIN_SAFE_ADDRESS;
  if (!registryAdminSafe || !ethers.isAddress(registryAdminSafe)) throw new Error("IREPN_REGISTRY_ADMIN_SAFE_ADDRESS_REQUIRED");
  const factory = await ethers.getContractFactory("Bep721PropertyIdentityToken");
  const contract = await factory.deploy(registryAdminSafe);
  await contract.waitForDeployment();
  const deployment = await contract.deploymentTransaction().wait();
  const artifact = await artifacts.readArtifact("Bep721PropertyIdentityToken");
  const abiHash = `0x${createHash("sha256").update(JSON.stringify(artifact.abi), "utf8").digest("hex")}`;
  console.log(JSON.stringify({ chainId, contractAddress: await contract.getAddress(), deploymentTxHash: deployment.hash, registryAdminSafe, abiHash }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
