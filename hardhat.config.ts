import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "@nomicfoundation/hardhat-verify";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 100,
      },
      viaIR: true,
    },
  },
  networks: {
    sepolia: {
      url: process.env.RPC_SEPOLIA,
      accounts: [
        process.env.PRIVATE_KEY_PUMPBTC!,
        process.env.PRIVATE_KEY_TESTONLY2!,
      ]
    }
  },
  etherscan: {
    apiKey: {
      sepolia: process.env.API_ETHERSCAN!,
    }
  }
};

export default config;

