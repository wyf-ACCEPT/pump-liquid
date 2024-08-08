import { expect } from "chai"
import { ethers, upgrades } from "hardhat"
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers"
import { LiquidCashier, LiquidOracle, LiquidVault } from "../typechain-types"
import { deployTokens } from "../scripts/utils"
import { formatEther, formatUnits, parseEther, parseUnits, ZeroAddress } from "ethers"

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
    // ============================ Initialize ============================
    const { tokens, liquidOracle, liquidVault, liquidCashier } = await loadFixture(deployContracts)
    const [_owner, updater, user1, lp] = await ethers.getSigners()

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

    // ============================ Deposit ============================
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
    let passedDays = ((await time.latest() - parseInt(depositInfo[1].toString())) / 86400).toFixed(2)
    console.log(`\t[Day ${day}] User deposit info:`)
    console.log(`\t\t Share balance: ${formatEther(depositInfo[0])}`)
    console.log(`\t\t Equivalent deposit day: ${passedDays} days ago`)
    console.log(`\t\t Equivalent standard price: ${formatUnits(depositInfo[2], 36)}`)

    // ========================= Request Withdraw =========================
    // Update prices 40 days later (60 days in total)
    day += 40
    await time.increase(40 * 86400)
    await liquidOracle.connect(updater).updatePrices([
      parseUnits("32000", 36 + 18 - 18),
      parseUnits("32000", 36 + 18 - 8),
      parseUnits("0.8", 36 + 18 - 6),
      parseUnits("0.8", 36 + 18 - 6),
      parseUnits("0.8", 36 + 18 - 18),
    ])
    
    // User 1 withdraw 20000 bSHARE to USDC
    /**
     * 20000 bSHARE / [0.8 bSHARE/USDC] = 25000 USDC
     * Management fee: { 60 days, 2%/year, 20000 bSHARE, 0.8 bSHARE/USDC } -> 61.6438 USDC
     * Performance fee: { price: 0.95 -> 1.25, 20%, 20000 bSHARE, 0.8 bSHARE/USDC } -> 1200 USDC
     * Exit fee: { 1%, 20000 bSHARE, 0.8 bSHARE/USDC } -> 250 USDC
     * Total: 61.6438 + 1200 + 250 = 1511.6438 USDC
     */
    expect(await liquidOracle.shareToAsset(tokenAddresses[2], parseUnits("20000", 18)))
      .to.equal(parseUnits("25000", 6))
    const fees = await liquidCashier.calculateFees(parseUnits("25000", 6), user1.address)
    expect(fees[0]).to.closeTo(parseUnits("61.6438", 6), parseUnits("0.0001", 6))
    expect(fees[1]).to.closeTo(parseUnits("1200.0000", 6), parseUnits("0.0001", 6))
    expect(fees[2]).to.closeTo(parseUnits("250.0000", 6), parseUnits("0.0001", 6))
    expect(fees[3]).to.closeTo(parseUnits("1511.6438", 6), parseUnits("0.0001", 6))
    await liquidCashier.connect(user1).requestWithdraw(tokenAddresses[2], parseUnits("20000", 18))

    // Show logs
    const pendingInfo = await liquidCashier.pendingInfo(user1.address)
    passedDays = ((await time.latest() - parseInt(pendingInfo[1].toString())) / 86400).toFixed(2)
    console.log(`\t[Day ${day}] User pending info:`)
    console.log(`\t\t Pending Share: ${formatEther(pendingInfo[0])}`)
    console.log(`\t\t Pending timestamp: ${passedDays} days ago`)
    console.log(`\t\t Pending assets: ${formatUnits(pendingInfo[3], 6)} USDC`)
    console.log(`\t\t Charged fees: ${formatUnits(pendingInfo[4], 6)} USDC`)

    // Liquid manager deposit some USDC to the vault
    tokens.mockUSDC.connect(lp).transfer(await liquidVault.getAddress(), parseUnits("30000", 6))
    
    // ========================= Complete Withdraw =========================
    // Complete withdraw after 7 days
    day += 7
    await time.increase(7 * 86400 - 10)
    await expect(liquidCashier.connect(user1).completeWithdraw())
      .to.be.revertedWith("LIQUID_CASHIER: still pending")
    await time.increase(11)

    const balanceBefore = await tokens.mockUSDC.balanceOf(user1.address)
    await liquidCashier.connect(user1).completeWithdraw()
    const balanceAfter = await tokens.mockUSDC.balanceOf(user1.address)
    console.log(`\t[Day ${day}] User completed withdraw, received: ${
      formatUnits(balanceAfter -balanceBefore, 6)
    } USDC`)
    
  })
  
})
