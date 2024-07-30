import { expect } from "chai"
import { ethers, upgrades } from "hardhat"
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers"
import { LiquidOracle } from "../typechain-types"

describe("test the functions", function () {

  async function deployContracts() {
    const liquidOracleFactory = await ethers.getContractFactory("LiquidOracle")
    const liquidOracle = (await upgrades.deployProxy(liquidOracleFactory)) as unknown as LiquidOracle
    return { liquidOracle }
  }

  it("should deploy the contract correctly", async function () {
    await loadFixture(deployContracts)
  })


  it("should finish user journey", async function () {
    const { liquidOracle } = await loadFixture(deployContracts)
    const [deployer, operator, user1, user2] = await ethers.getSigners()
    console.log(await liquidOracle.STANDARD_PRICE_ADDRESS())
    console.log(await liquidOracle.PRICE_UPDATER_ROLE())
  })
  
})
