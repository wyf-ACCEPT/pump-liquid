import { expect } from "chai"
import { ethers, upgrades } from "hardhat"
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers"
import { LiquidCashier, LiquidOracle, LiquidVault } from "../typechain-types"
import { deployTokens } from "../scripts/utils"
import { formatEther, formatUnits, parseEther, parseUnits } from "ethers"

describe("test cashier core", function () {

  async function deployContracts() {
    const [
      _owner, _updater, _user1, _lp, feeCollector1, feeCollector2, feeManager
    ] = await ethers.getSigners()

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

    await liquidCashier.setFeeReceiverDefault(feeCollector1.address)
    await liquidCashier.setFeeReceiverThirdParty(feeCollector2.address)
    await liquidCashier.setFeeManager(feeManager.address, true)

    await liquidCashier.setParameter("thirdPartyRatioManagement", 0)
    await liquidCashier.setParameter("thirdPartyRatioPerformance", 4000)
    await liquidCashier.setParameter("thirdPartyRatioExit", 0)
    await expect(liquidCashier.setParameter("feeRate", 0))
      .to.be.revertedWith("LIQUID_CASHIER: invalid key")

    return { tokens, liquidOracle, liquidVault, liquidCashier }
  }

  
  it("should deploy the contract correctly", async function () {
    await loadFixture(deployContracts)
  })


  it("should finish test for cashier", async function () {
    // ============================ Initialize ============================
    const {
      tokens, liquidOracle, liquidVault, liquidCashier
    } = await loadFixture(deployContracts)
    const [
      _owner, updater, user1, lp, feeCollector1, feeCollector2, feeManager
    ] = await ethers.getSigners()

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
    await liquidCashier.connect(feeManager).collectFees() // First time to record the highest share price


    // ============================ Deposit ============================
    // User 1 deposit 0.2 BTCB -> 12000 bSHARE
    let day = 0
    await tokens.mockBTCB.connect(user1)
      .approve(await liquidCashier.getAddress(), parseUnits("0.2", 18))
    await liquidCashier.connect(user1).deposit(tokenAddresses[0], parseUnits("0.2", 18))
    expect(await liquidVault.balanceOf(user1.address)).to.equal(parseUnits("12000", 18))
    console.log(`\t[Day ${day}] Deposit 0.2 $BTCB for 12000 $bSHARE`)

    // User 1 deposit 10000 USDC -> 12000 bSHARE
    await tokens.mockUSDC.connect(user1)
      .approve(await liquidCashier.getAddress(), parseUnits("10000", 6))
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

    // Collect fees
    /**
     * Management fee: { 20 days, 2%/year, 24000 bSHARE } -> 26.3014 bSHARE
     * Performance fee: { price: 0.8 -> 1.0, 20%, 24000 bSHARE } -> 1200 bSHARE: {60%, 40%}
     */
    await liquidCashier.connect(feeManager).collectFees()
    expect(await liquidVault.balanceOf(feeCollector1.address))
      .to.closeTo(parseEther("746.3014"), parseEther("0.0001"))   // 720 + 26.3014
    expect(await liquidVault.balanceOf(feeCollector2.address))
      .to.closeTo(parseEther("480"), parseEther("0.0001"))
    expect(await liquidVault.totalSupply())
      .to.closeTo(parseEther("25226.3014"), parseEther("0.0001"))  // 24000 + 1200 + 26.3014

    // User 1 deposit 1.8 WBTC -> 72000 bSHARE
    await tokens.mockWBTC.connect(user1)
      .approve(await liquidCashier.getAddress(), parseUnits("1.8", 8))
    await liquidCashier.connect(user1).deposit(tokenAddresses[1], parseUnits("1.8", 8))
    expect(await liquidVault.balanceOf(user1.address)).to.equal(parseUnits("96000", 18))
    console.log(`\t[Day ${day}] Deposit 1.8 $WBTC for 72000 $bSHARE`)
    

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
     * Exit fee: { 1%, 20000 bSHARE } -> 200 bSHARE
     * Amount net: (20000 - 200) / 0.8 = 24750 USDC
     */
    expect(await liquidOracle.shareToAsset(tokenAddresses[2], parseUnits("20000", 18)))
      .to.equal(parseUnits("25000", 6))
    const assetAmountNet = await liquidCashier.connect(user1)
      .simulateRequestWithdraw(tokenAddresses[2], parseUnits("20000", 18))
    console.log(`\t[Day ${day}] Simulate request withdraw, asset amount net: ${formatUnits(assetAmountNet, 6)} USDC`)
    await liquidCashier.connect(user1).requestWithdraw(tokenAddresses[2], parseUnits("20000", 18))

    // Show logs
    const pendingInfo = await liquidCashier.pendingInfo(user1.address)
    const passedDays = ((await time.latest() - parseInt(pendingInfo[1].toString())) / 86400).toFixed(2)
    console.log(`\t[Day ${day}] User pending info:`)
    console.log(`\t\t Pending Share: ${formatEther(pendingInfo[0])}`)
    console.log(`\t\t Pending timestamp: ${passedDays} days ago`)
    console.log(`\t\t Pending assets: ${formatUnits(pendingInfo[3], 6)} USDC`)
    console.log(`\t\t Charged fees: ${formatUnits(pendingInfo[4], 6)} bSHARE`)

    // Liquidity manager deposit some USDC to the vault
    await liquidVault.addStrategyWithdrawLiquidityDirectly(tokenAddresses[1])
    const strategyId = await liquidVault.strategiesLength() - 1n
    await liquidVault.setLiquidityManager(lp.address, true)
    tokens.mockUSDC.connect(lp).approve(await liquidVault.getAddress(), parseUnits("30000", 6))

    const balanceWBTCBefore = await tokens.mockWBTC.balanceOf(lp.address)
    await tokens.mockUSDC.connect(lp).transfer(
      await liquidVault.getAddress(), parseUnits("30000", 6),   // Direct transfer to deposit liquidity
    )
    await liquidVault.connect(lp).executeStrategy(strategyId, tokens.mockWBTC.interface.encodeFunctionData(
      "transfer", [lp.address, parseUnits("1.2", 8)]     // Execute strategy to withdraw liquidity
    ))
    const balanceWBTCAfter = await tokens.mockWBTC.balanceOf(lp.address)
    expect(balanceWBTCAfter - balanceWBTCBefore).to.equal(parseUnits("1.2", 8))


    // ========================= Complete Withdraw =========================
    // Complete withdraw after 7 days
    day += 7
    await time.increase(7 * 86400 - 10)
    await expect(liquidCashier.connect(user1).completeWithdraw())
      .to.be.revertedWith("LIQUID_CASHIER: still pending")
    await time.increase(11)

    // Collect fees
    /**
     * Total supply: 24000 + 1200 + 26.3014 + 72000 - 20000 = 77226.3014
     * Management fee: { 20 -> 67 days, 2%/year, 77226.3014 bSHARE } -> 198.8842 bSHARE
     * Performance fee: { price: 1.0 -> 1.25, 20%, 77226.3014 bSHARE } -> 3861.3151 bSHARE: {60%, 40%}
     */
    await liquidCashier.connect(feeManager).collectFees()
    expect(await liquidVault.balanceOf(feeCollector1.address))
      .to.closeTo(parseEther("3261.9747"), parseEther("0.001"))   // {746.3014} + 198.8842 + 3861.3151 * 0.6
    expect(await liquidVault.balanceOf(feeCollector2.address))
      .to.closeTo(parseEther("2024.5260"), parseEther("0.001"))   // {480} + 3861.3151 * 0.4
    expect(await liquidVault.totalSupply())
      .to.closeTo(parseEther("81286.5007"), parseEther("0.001"))  // {77226.3014} + 198.8842 + 3861.3151

    // User 1 complete withdraw
    const balanceBefore = await tokens.mockUSDC.balanceOf(user1.address)
    expect(await liquidCashier.connect(user1).simulateCompleteWithdraw()).to.be.true
    await liquidCashier.connect(user1).completeWithdraw()
    const balanceAfter = await tokens.mockUSDC.balanceOf(user1.address)
    console.log(`\t[Day ${day}] User completed withdraw, received: ${
      formatUnits(balanceAfter - balanceBefore, 6)
    } USDC`)

    // Check exit fee
    expect(await liquidVault.balanceOf(feeCollector1.address))
      .to.closeTo(parseEther("3461.9747"), parseEther("0.001"))   // {3261.9747} + 200 * 100%
    expect(await liquidVault.balanceOf(feeCollector2.address))
      .to.closeTo(parseEther("2024.5260"), parseEther("0.001"))   // {2024.5260}
    expect(await liquidVault.totalSupply())
      .to.closeTo(parseEther("81486.5007"), parseEther("0.001"))  // {81286.5007} + 200

    // Remove liquidity manager
    await liquidVault.setLiquidityManager(lp.address, false)
    await expect(liquidVault.connect(lp).executeStrategy(
      strategyId, tokens.mockWBTC.interface.encodeFunctionData("transfer", [lp.address, parseUnits("1.2", 8)])
    )).to.be.revertedWithCustomError(liquidVault, "AccessControlUnauthorizedAccount")

    // Remove fee manager
    await liquidCashier.setFeeManager(feeManager.address, false)
    await expect(liquidCashier.connect(feeManager).collectFees())
      .to.be.revertedWithCustomError(liquidCashier, "AccessControlUnauthorizedAccount")
  
  })


  it("should finish test for cashier in other branches", async function () {
    // ============================ Initialize ============================
    const { tokens, liquidOracle, liquidVault, liquidCashier } = await loadFixture(deployContracts)
    const [
      _owner, updater, user1, lp, feeCollector1, feeCollector2, feeManager
    ] = await ethers.getSigners()

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
    await liquidCashier.connect(feeManager).collectFees() // First time to record the highest share price


    // ============================ Deposit ============================
    // User 1 deposit 0.2 BTCB -> 12000 bSHARE, deposit 10000 USDC -> 12000 bSHARE
    let day = 0
    await tokens.mockBTCB.connect(user1)
      .approve(await liquidCashier.getAddress(), parseUnits("0.2", 18))
    await liquidCashier.connect(user1).deposit(tokenAddresses[0], parseUnits("0.2", 18))
    await tokens.mockUSDC.connect(user1)
      .approve(await liquidCashier.getAddress(), parseUnits("10000", 6))
    await liquidCashier.connect(user1).deposit(tokenAddresses[2], parseUnits("10000", 6))

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

    // Collect fees (Same as above)
    await liquidCashier.connect(feeManager).collectFees()
    expect(await liquidVault.balanceOf(feeCollector1.address))
      .to.closeTo(parseEther("746.3014"), parseEther("0.0001"))   // 720 + 26.3014
    expect(await liquidVault.balanceOf(feeCollector2.address))
      .to.closeTo(parseEther("480"), parseEther("0.0001"))
    expect(await liquidVault.totalSupply())
      .to.closeTo(parseEther("25226.3014"), parseEther("0.0001"))  // 24000 + 1200 + 26.3014

    // User 1 deposit 1.8 WBTC -> 72000 bSHARE
    await tokens.mockWBTC.connect(user1)
      .approve(await liquidCashier.getAddress(), parseUnits("1.8", 8))
    await liquidCashier.connect(user1).deposit(tokenAddresses[1], parseUnits("1.8", 8))


    // =========================== Set fee rates ===========================
    await liquidCashier.setParameter("feeRateManagement", 400)
    await liquidCashier.setParameter("feeRatePerformance", 3000)
    await liquidCashier.setParameter("feeRateExit", 150)
    await liquidCashier.setParameter("feeRateInstant", 700)
    await liquidCashier.setParameter("thirdPartyRatioManagement", 2000)
    await liquidCashier.setParameter("thirdPartyRatioPerformance", 5000)
    await liquidCashier.setParameter("thirdPartyRatioExit", 2000)
    await expect(liquidCashier.setParameter("feeRate", 1000))
      .to.be.revertedWith("LIQUID_CASHIER: invalid key")


    // ========================= Instant Withdraw =========================
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

    // Collect fees
    /**
     * Total supply: 24000 + 1200 + 26.3014 + 72000 = 97226.3014
     * Management fee: { 20 -> 60 days, 4%/year, 97226.3014 bSHARE } -> 426.1975 bSHARE: {80%, 20%}
     * Performance fee: { price: 1.0 -> 1.25, 30%, 97226.3014 bSHARE } -> 7291.9726 bSHARE: {50%, 50%}
     */
    await liquidCashier.connect(feeManager).collectFees()
    expect(await liquidVault.balanceOf(feeCollector1.address))
      .to.closeTo(parseEther("4733.2457"), parseEther("0.002"))   // {746.3014} + 426.1975 * 0.8 + 7291.9726 * 0.5
    expect(await liquidVault.balanceOf(feeCollector2.address))
      .to.closeTo(parseEther("4211.2258"), parseEther("0.002"))   // {480} + 426.1975 * 0.2 + 7291.9726 * 0.5
    expect(await liquidVault.totalSupply())
      .to.closeTo(parseEther("104944.4715"), parseEther("0.002"))  // {97226.3014} + 426.1975 + 7291.9726

    // LP deposit some USDC to the vault
    await expect(liquidCashier.connect(user1).instantWithdraw(
      tokenAddresses[2], parseUnits("20000", 18)
    )).to.be.revertedWithCustomError(liquidVault, "ERC20InsufficientBalance")
    await tokens.mockUSDC.connect(lp).approve(await liquidVault.getAddress(), parseUnits("25000", 6))
    await liquidVault.setLiquidityManager(lp.address, true)
    await tokens.mockUSDC.connect(lp).transfer(
      await liquidVault.getAddress(), parseUnits("25000", 6)     // Direct transfer to deposit liquidity
    )

    // User 1 instant withdraw
    /**
     * Exit fee: { 7%, 20000 bSHARE } -> 1400 bSHARE
     * Amount net: (20000 - 1400) / 0.8 = 23250 USDC
     */
    const assetAmountNet = await liquidCashier.connect(user1)
      .simulateInstantWithdraw(tokenAddresses[2], parseUnits("20000", 18))
    console.log(`\t[Day ${day}] Simulate instant withdraw, asset amount net: ${formatUnits(assetAmountNet, 6)} USDC`)
    const balanceBefore = await tokens.mockUSDC.balanceOf(user1.address)
    await liquidCashier.connect(user1).instantWithdraw(tokenAddresses[2], parseUnits("20000", 18))
    const balanceAfter = await tokens.mockUSDC.balanceOf(user1.address)
    console.log(`\t[Day ${day}] User instant withdraw, received: ${
      formatUnits(balanceAfter - balanceBefore, 6)
    } USDC`)

    // Check exit fee
    expect(await liquidVault.balanceOf(feeCollector1.address))
      .to.closeTo(parseEther("5853.2457"), parseEther("0.002"))   // {4733.2457} + 1400 * 0.8
    expect(await liquidVault.balanceOf(feeCollector2.address))
      .to.closeTo(parseEther("4491.2258"), parseEther("0.002"))   // {4211.2258} + 1400 * 0.2
    expect(await liquidVault.totalSupply())
      .to.closeTo(parseEther("86344.4715"), parseEther("0.002"))  // {104944.4715} - 20000 + 1400

    await liquidCashier.setParameter("feeRateManagement", 200)
    await liquidCashier.setParameter("feeRatePerformance", 2000)
    await liquidCashier.setParameter("feeRateExit", 100)
    await liquidCashier.setParameter("feeRateInstant", 500)
    await liquidCashier.setParameter("withdrawPeriod", 7 * 86400)


    // ========================= Request Withdraw =========================
    await liquidCashier.connect(user1).requestWithdraw(tokenAddresses[1], parseUnits("2000", 18))

    // Show logs
    const pendingInfo = await liquidCashier.pendingInfo(user1.address)
    const passedDays = ((await time.latest() - parseInt(pendingInfo[1].toString())) / 86400).toFixed(2)
    console.log(`\t[Day ${day}] User pending info:`)
    console.log(`\t\t Pending Share: ${formatEther(pendingInfo[0])}`)
    console.log(`\t\t Pending timestamp: ${passedDays} days ago`)
    console.log(`\t\t Pending assets: ${formatUnits(pendingInfo[3], 8)} WBTC`)
    console.log(`\t\t Charged fees: ${formatUnits(pendingInfo[4], 8)} WBTC`)

    // Remove WBTC asset
    day += 3
    await time.increase(3 * 86400)
    await liquidOracle.removeSupportedAsset(tokenAddresses[1])
    console.log(`\t[Day ${day}] Remove WBTC asset`)

    // Complete withdraw failed
    day += 5
    await time.increase(5 * 86400)

    const holdingShares = await liquidVault.balanceOf(user1.address)
    expect(await liquidCashier.connect(user1).simulateCompleteWithdraw()).to.be.false
    await liquidCashier.connect(user1).completeWithdraw()
    expect(await liquidVault.balanceOf(user1.address) - holdingShares)
      .to.be.equal(pendingInfo[0])


    // ========================= Pause & Unpause =========================
    await liquidCashier.pause()
    await tokens.mockBTCB.connect(user1)
      .approve(await liquidCashier.getAddress(), parseUnits("0.1", 18))
    await expect(liquidCashier.connect(user1).simulateDeposit(tokenAddresses[0], parseUnits("0.1", 18)))
      .to.be.revertedWithCustomError(liquidCashier, "EnforcedPause")
    await expect(liquidCashier.connect(user1).deposit(tokenAddresses[0], parseUnits("0.1", 18)))
      .to.be.revertedWithCustomError(liquidCashier, "EnforcedPause")

    await liquidCashier.unpause()
    await liquidCashier.connect(user1).simulateDeposit(tokenAddresses[0], parseUnits("0.1", 18))
    await liquidCashier.connect(user1).deposit(tokenAddresses[0], parseUnits("0.1", 18))

  })

})
