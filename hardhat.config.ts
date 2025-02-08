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
    mainnet: {
      url: process.env.RPC_MAINNET,
      accounts: [
        process.env.PK_FACTORY_OWNER!,
        process.env.PK_VAULT_OWNER!,
        process.env.PK_LIQUIDITY_MANAGER!,
      ]
    },
    sepolia: {
      url: process.env.RPC_SEPOLIA,
      accounts: [
        process.env.PK_FACTORY_OWNER!,
        process.env.PK_VAULT_OWNER!,
        process.env.PK_LIQUIDITY_MANAGER!,
      ]
    },
    arbitrum: {
      url: process.env.RPC_ARB,
      accounts: [
        process.env.PK_ARB_OWNER!,
      ]
    },
    hardhat: {
      forking: {
        url: process.env.RPC_MAINNET!,
        blockNumber: 21350000,
      }
    },
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.API_ETHERSCAN!,
      sepolia: process.env.API_ETHERSCAN!,
      arbitrumOne: process.env.API_ARBSCAN!,
    }
  }
};

export default config;

