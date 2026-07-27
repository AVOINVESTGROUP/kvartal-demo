require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version: "0.8.26",
    settings: { optimizer: { enabled: true, runs: 500 }, evmVersion: "cancun" },
  },
  networks: { hardhat: { chainId: 31337 } },
};
