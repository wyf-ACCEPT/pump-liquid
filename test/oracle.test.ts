import { expect } from "chai"
import { ethers, upgrades } from "hardhat"
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers"
import { LiquidOracle } from "../typechain-types"
import { deployTokens } from "../scripts/utils"
import { formatEther, parseUnits, ZeroAddress } from "ethers"

describe("test the functions", function () {

  async function deployContracts() {
    const tokens = await deployTokens()
    const liquidOracleFactory = await ethers.getContractFactory("LiquidOracle")
    const liquidOracle = (await upgrades.deployProxy(liquidOracleFactory)) as unknown as LiquidOracle
    return { liquidOracle, tokens }
  }

  it("should deploy the contract correctly", async function () {
    await loadFixture(deployContracts)
  })


  it("should finish user journey", async function () {
    const { liquidOracle, tokens } = await loadFixture(deployContracts)
    const [_owner, updater, user1, user2] = await ethers.getSigners()

    const tokenAddresses = []
    for (const [_name, token] of Object.entries(tokens)) {
      await liquidOracle.addSupportedAsset(await token.getAddress())
      tokenAddresses.push(await token.getAddress())
      const symbol = await token.symbol()
      const decimal = await token.decimals()
      console.log(`\tAdded ${symbol} to supported assets, with ${decimal} decimals`)
    }
    tokenAddresses.push(ZeroAddress)

    // Revert: Called by unauthorized account
    await expect(liquidOracle.updatePrices(tokenAddresses, [1, 1, 1, 1, 1]))
      .to.be.revertedWithCustomError(liquidOracle, "AccessControlUnauthorizedAccount")
    
    // Revert: No standard price address
    await liquidOracle.setPriceUpdater(updater.address, true)
    await expect(liquidOracle.connect(updater).updatePrices(tokenAddresses, [1, 1, 1, 1, 1]))
      .to.be.revertedWith("PUMP_LIQUID_ORACLE: asset not found")
    
    tokenAddresses.pop()
    tokenAddresses.push(await liquidOracle.STANDARD_ASSET())

    await liquidOracle.connect(updater).updatePrices(tokenAddresses, [1, 1, 1, 1, 1])

    // Revert: Update too frequently
    await (expect(liquidOracle.connect(updater).updatePrices(tokenAddresses, [1, 1, 1, 1, 1])))
      .to.be.revertedWith("PUMP_LIQUID_ORACLE: update too frequently")
    
    await time.increase(await liquidOracle.minimumUpdateInterval() + 5n)

    await liquidOracle.connect(updater).updatePrices(tokenAddresses, [
      parseUnits("70000", 36 + 18 - 18),
      parseUnits("70000", 36 + 18 - 8),
      parseUnits("1.2", 36 + 18 - 6),
      parseUnits("1.2", 36 + 18 - 6),
      parseUnits("1.2", 36 + 18 - 18),
    ])

    console.log(`\tCan swap 1 USDT (1e6 unit USDT) to ${
      formatEther(await liquidOracle.assetToShare(tokenAddresses[3], 1_000000))
    } shares`)

  })
  
})
