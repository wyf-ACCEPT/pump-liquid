import { expect } from "chai"
import { ethers, upgrades } from "hardhat"
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers"
import { LiquidOracle } from "../typechain-types"
import { deployTokens } from "../scripts/utils"
import { formatEther, parseUnits, ZeroAddress } from "ethers"

describe("test oracle core", function () {

  async function deployContracts() {
    const tokens = await deployTokens()
    const liquidOracleFactory = await ethers.getContractFactory("LiquidOracle")
    const liquidOracle = (await upgrades.deployProxy(liquidOracleFactory)) as unknown as LiquidOracle
    return { liquidOracle, tokens }
  }

  
  it("should deploy the contract correctly", async function () {
    await loadFixture(deployContracts)
  })


  it("should finish test for oracle", async function () {
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
    await expect(liquidOracle.updatePrices([1, 1, 1, 1, 1]))
      .to.be.revertedWithCustomError(liquidOracle, "AccessControlUnauthorizedAccount")
    
    // Revert: No standard price address
    await liquidOracle.setPriceUpdater(updater.address, true)
    await expect(liquidOracle.connect(updater).updatePrices([1, 1, 1, 1]))
      .to.be.revertedWith("LIQUID_ORACLE: invalid input length")
    
    tokenAddresses.pop()
    tokenAddresses.push(await liquidOracle.STANDARD_ASSET())

    await liquidOracle.connect(updater).updatePrices([1, 1, 1, 1, 1])

    // Revert: Update too frequently
    await (expect(liquidOracle.connect(updater).updatePrices([1, 1, 1, 1, 1])))
      .to.be.revertedWith("LIQUID_ORACLE: update too frequently")
    
    await time.increase(await liquidOracle.minimumUpdateInterval() + 5n)

    await liquidOracle.connect(updater).updatePrices([
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


  it("should work when calling the view functions", async function () {
    const { liquidOracle, tokens } = await loadFixture(deployContracts)
    const [_owner, updater] = await ethers.getSigners()

    const tokenAddresses = []
    for (const [_name, token] of Object.entries(tokens)) {
      await liquidOracle.addSupportedAsset(await token.getAddress())
      tokenAddresses.push(await token.getAddress())
    }
    tokenAddresses.push(await liquidOracle.STANDARD_ASSET())

    await liquidOracle.setPriceUpdater(updater.address, true)
    await liquidOracle.connect(updater).updatePrices([
      parseUnits("50000", 36 + 18 - 18),
      parseUnits("50000", 36 + 18 - 8),
      parseUnits("1.2", 36 + 18 - 6),
      parseUnits("1.2", 36 + 18 - 6),
      parseUnits("1.25", 36 + 18 - 18),
    ])

    expect(await liquidOracle.assetPriceToShareExternal(tokenAddresses[0]))
      .to.equal(parseUnits("50000", 36 + 18 - 18))
    expect(await liquidOracle.sharePriceToAssetExternal(tokenAddresses[4]))
      .to.equal(parseUnits("0.8", 36 + 18 - 18))
    expect(await liquidOracle.getSupportedAssetsNum())
      .to.equal(4)
    
    expect(await liquidOracle.fetchAssetsPricesAll())
      .to.deep.equal([
        parseUnits("50000", 36 + 18 - 18),
        parseUnits("50000", 36 + 18 - 8),
        parseUnits("1.2", 36 + 18 - 6),
        parseUnits("1.2", 36 + 18 - 6),
        parseUnits("1.25", 36 + 18 - 18),
      ])

    const sharePrices = await liquidOracle.fetchSharePricesAll()
    expect(sharePrices[0]).to.equal(parseUnits("0.00002", 36 - 18 + 18))
    expect(sharePrices[1]).to.equal(parseUnits("0.00002", 36 - 18 + 8))
    expect(sharePrices[2]).to.closeTo(
      parseUnits("0.8333", 36 - 18 + 6), parseUnits("0.001", 36 - 18 + 6)
    )
    expect(sharePrices[3]).to.closeTo(
      parseUnits("0.8333", 36 - 18 + 6), parseUnits("0.001", 36 - 18 + 6)
    )
    expect(sharePrices[4]).to.equal(parseUnits("0.8", 36 - 18 + 18))

    // Revert: Called by unauthorized account
    await liquidOracle.setPriceUpdater(updater.address, false)
    await expect(liquidOracle.updatePrices([1, 1, 1, 1, 1]))
      .to.be.revertedWithCustomError(liquidOracle, "AccessControlUnauthorizedAccount")
  })
  
})
