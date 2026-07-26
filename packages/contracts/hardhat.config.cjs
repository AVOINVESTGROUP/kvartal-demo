require("@nomicfoundation/hardhat-toolbox");

const testnetPrivateKey = process.env.BSC_TESTNET_DEPLOYER_PRIVATE_KEY;
const mainnetPrivateKey = process.env.BSC_MAINNET_DEPLOYER_PRIVATE_KEY;

module.exports = {
  solidity: {
    version: "0.8.26",
    settings: { optimizer: { enabled: true, runs: 500 }, evmVersion: "cancun" },
  },
  networks: {
    hardhat: { chainId: 31337 },
    bscTestnet: {
      url: process.env.PROPERTY_IDENTITY_RPC_URL || "https://bsc-testnet-dataseed.bnbchain.org",
      chainId: 97,
      accounts: testnetPrivateKey ? [testnetPrivateKey] : [],
    },
    bscMainnet: {
      url: process.env.PROPERTY_IDENTITY_MAINNET_RPC_URL || "https://bsc-dataseed.bnbchain.org",
      chainId: 56,
      accounts: mainnetPrivateKey ? [mainnetPrivateKey] : [],
    },
  },
};
