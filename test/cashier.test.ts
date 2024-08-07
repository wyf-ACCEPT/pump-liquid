import { expect } from "chai"
import { ethers, upgrades } from "hardhat"
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers"
import { LiquidCashier, LiquidOracle, LiquidVault } from "../typechain-types"
import { deployTokens } from "../scripts/utils"
import { formatEther, formatUnits, parseUnits, ZeroAddress } from "ethers"

describe("test the functions", function () {

  async function deployContracts() {
    const tokens = await deployTokens()

    const liquidOracleFactory = await ethers.getContractFactory("LiquidOracle")
    const liquidOracle = (await upgrades.deployProxy(liquidOracleFactory)) as unknown as LiquidOracle

    const liquidVaultFactory = await ethers.getContractFactory("LiquidVault")
    const liquidVault = (await upgrades.deployProxy(
      liquidVaultFactory, ["BTC Liquid Vault Share", "bSHARE"]
    )) as unknown as LiquidVault

    const liquidCashierFactory = await ethers.getContractFactory("LiquidCashier")
    const liquidCashier = (await upgrades.deployProxy(
      liquidCashierFactory, [await liquidVault.getAddress(), await liquidOracle.getAddress()]
    )) as unknown as LiquidCashier

    await liquidVault.setCashier(await liquidCashier.getAddress())
    await expect(liquidVault.setCashier(await liquidCashier.getAddress()))
      .to.be.revertedWithCustomError(liquidVault, "InvalidInitialization")

    return { tokens, liquidOracle, liquidVault, liquidCashier }
  }

  it("should deploy the contract correctly", async function () {
    await loadFixture(deployContracts)
  })


  it("should finish test for cashier", async function () {
    const { tokens, liquidOracle, liquidVault, liquidCashier } = await loadFixture(deployContracts)
    const [_owner, updater, user1, user2] = await ethers.getSigners()

    // Update tokens and prices
    const tokenAddresses = []
    for (const [_name, token] of Object.entries(tokens)) {
      await liquidOracle.addSupportedAsset(await token.getAddress())
      tokenAddresses.push(await token.getAddress())
    }
    tokenAddresses.push(await liquidOracle.STANDARD_ASSET())

    // Update prices
    await liquidOracle.setPriceUpdater(updater.address, true)
    await liquidOracle.connect(updater).updatePrices([
      parseUnits("60000", 36 + 18 - 18),
      parseUnits("60000", 36 + 18 - 8),
      parseUnits("1.2", 36 + 18 - 6),
      parseUnits("1.2", 36 + 18 - 6),
      parseUnits("1.25", 36 + 18 - 18),
    ])

    // User 1 deposit 0.2 BTCB -> 12000 bSHARE
    let day = 0
    await tokens.mockBTCB.connect(user1)
      .approve(await liquidVault.getAddress(), parseUnits("0.2", 18))
    await liquidCashier.connect(user1).deposit(tokenAddresses[0], parseUnits("0.2", 18))
    expect(await liquidVault.balanceOf(user1.address)).to.equal(parseUnits("12000", 18))
    console.log(`\t[Day ${day}] Deposit 0.2 $BTCB for 12000 $bSHARE`)

    // User 1 deposit 10000 USDC -> 12000 bSHARE
    await tokens.mockUSDC.connect(user1)
      .approve(await liquidVault.getAddress(), parseUnits("10000", 6))
    await liquidCashier.connect(user1).deposit(tokenAddresses[2], parseUnits("10000", 6))
    expect(await liquidVault.balanceOf(user1.address)).to.equal(parseUnits("24000", 18))
    console.log(`\t[Day ${day}] Deposit 10000 $USDC for 12000 $bSHARE`)

    // Update prices 20 days later
    day += 20
    await time.increase(20 * 86400)
    await liquidOracle.connect(updater).updatePrices([
      parseUnits("40000", 36 + 18 - 18),
      parseUnits("40000", 36 + 18 - 8),
      parseUnits("1.0", 36 + 18 - 6),
      parseUnits("1.0", 36 + 18 - 6),
      parseUnits("1.0", 36 + 18 - 18),
    ])
    
    // User 1 deposit 1.8 WBTC -> 72000 bSHARE
    await tokens.mockWBTC.connect(user1)
      .approve(await liquidVault.getAddress(), parseUnits("1.8", 8))
    await liquidCashier.connect(user1).deposit(tokenAddresses[1], parseUnits("1.8", 8))
    expect(await liquidVault.balanceOf(user1.address)).to.equal(parseUnits("96000", 18))
    console.log(`\t[Day ${day}] Deposit 1.8 $WBTC for 72000 $bSHARE`)

    // Show deposit info
    const depositInfo = await liquidCashier.depositInfo(user1.address)
    const passedDays = ((await time.latest() - parseInt(depositInfo[1].toString())) / 86400).toFixed(2)
    console.log(`\t[Day ${day}] User deposit info:`)
    console.log(`\t\t Share balance: ${formatEther(depositInfo[0])}`)
    console.log(`\t\t Equivalent deposit day: ${passedDays} days ago`)
    console.log(`\t\t Equivalent standard price: ${formatUnits(depositInfo[2], 36)}`)

  })
  
})
