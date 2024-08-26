import { parseEther } from "ethers"
import { ethers, upgrades } from "hardhat"

const GREEN = "\x1b[32m"
const RESET = "\x1b[0m"

export async function deployContract(contractName: string, args: any[] = []) {
  const contractFactory = await ethers.getContractFactory(contractName)
  const contract = await contractFactory.deploy(...args)
  console.log(`${contractName} deployed to: ${GREEN}${await contract.getAddress()}${RESET}`)
  return contract
}

export async function deployUpgradeableContract(contractName: string, args: any[] = []) {
  const contractFactory = await ethers.getContractFactory(contractName)
  const contract = await upgrades.deployProxy(contractFactory, args)
  console.log(`${contractName}(upgradeable) deployed to: ${GREEN}${await contract.getAddress()}${RESET}`)
  return contract
}

export async function upgradeContract(proxyContractAddress: string, newContractName: string) {
  const newContractFactory = await ethers.getContractFactory(newContractName)
  const newContract = await upgrades.upgradeProxy(proxyContractAddress, newContractFactory)
  console.log(`${newContractName}(upgradeable) upgraded to: ${GREEN}${await newContract.getAddress()}${RESET}`)
  return newContract
}

export async function deployTokens() {
  const tokenFactory = await ethers.getContractFactory("MockToken")
  const mockBTCB = await tokenFactory.deploy("Binance-Peg BTCB Token", "BTCB", 18, parseEther("100"))
  const mockWBTC = await tokenFactory.deploy("Wrapped BTC", "WBTC", 8, parseEther("100"))
  const mockUSDC = await tokenFactory.deploy("USD Circle", "USDC", 6, parseEther("500000"))
  const mockUSDT = await tokenFactory.deploy("Tether USD", "USDT", 6, parseEther("500000"))
  const [_, __, _1, _2] = await ethers.getSigners()
  await mockBTCB.transfer(_1.address, parseEther("10"))
  await mockWBTC.transfer(_1.address, parseEther("10"))
  await mockUSDC.transfer(_1.address, parseEther("50000"))
  await mockUSDT.transfer(_1.address, parseEther("50000"))
  await mockBTCB.transfer(_2.address, parseEther("10"))
  await mockWBTC.transfer(_2.address, parseEther("10"))
  await mockUSDC.transfer(_2.address, parseEther("50000"))
  await mockUSDT.transfer(_2.address, parseEther("50000"))
  return { mockBTCB, mockWBTC, mockUSDC, mockUSDT }
}