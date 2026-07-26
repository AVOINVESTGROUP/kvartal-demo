const { ethers, network } = require("hardhat");

async function main() {
  if (Number(network.config.chainId) !== 97) throw new Error("DEPLOYMENT_RESTRICTED_TO_BSC_TESTNET");
  const registryAdminSafe = process.env.IREPN_REGISTRY_ADMIN_SAFE_ADDRESS;
  if (!registryAdminSafe || !ethers.isAddress(registryAdminSafe)) throw new Error("IREPN_REGISTRY_ADMIN_SAFE_ADDRESS_REQUIRED");
  if (!process.env.BSC_TESTNET_DEPLOYER_PRIVATE_KEY) throw new Error("BSC_TESTNET_DEPLOYER_PRIVATE_KEY_REQUIRED");

  const factory = await ethers.getContractFactory("Bep721PropertyIdentityToken");
  const contract = await factory.deploy(registryAdminSafe);
  await contract.waitForDeployment();
  const deployment = await contract.deploymentTransaction().wait();
  console.log(JSON.stringify({
    chainId: Number(network.config.chainId),
    contractAddress: await contract.getAddress(),
    deploymentTxHash: deployment.hash,
    registryAdminSafe,
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
