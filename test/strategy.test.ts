import { expect } from "chai"
import { ethers, upgrades } from "hardhat"
import { ContractFactory, formatEther, formatUnits, parseEther, parseUnits } from "ethers"

import WETH9 from "@uniswap/v2-periphery/build/WETH9.json"
import uniswapFactoryInfo from "@uniswap/v2-core/build/UniswapV2Factory.json"
import uniswapRouterInfo from "@uniswap/v2-periphery/build/UniswapV2Router01.json"
import { IUniswapV2Router02, LiquidCashier, LiquidOracle, LiquidVault } from "../typechain-types"

import { deployTokens } from "../scripts/utils"
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers"

describe("test the user journey of the DEX", function () {

  async function deployContracts() {
    const [deployer] = await ethers.getSigners()

    // Deploy WETH, DEX Factory & Router
    const WETH = await new ContractFactory(
      WETH9.abi, WETH9.bytecode, deployer
    ).deploy()
    const WETHAddress = await WETH.getAddress()

    const dexFactory = await new ContractFactory(
      uniswapFactoryInfo.abi, uniswapFactoryInfo.bytecode, deployer
    ).deploy(deployer.address)
    const dexFactoryAddress = await dexFactory.getAddress()

    const dexRouter = await new ContractFactory(
      uniswapRouterInfo.abi, uniswapRouterInfo.bytecode, deployer
    ).deploy(
      dexFactoryAddress, WETHAddress
    ) as IUniswapV2Router02
    const dexRouterAddress = await dexRouter.getAddress()

    // Add liquidity
    const tokens = await deployTokens()
    await tokens.mockBTCB.approve(dexRouterAddress, parseEther("10"))
    await tokens.mockUSDC.approve(dexRouterAddress, parseUnits("500000", 6))
    await dexRouter.addLiquidity(
      await tokens.mockBTCB.getAddress(), await tokens.mockUSDC.getAddress(),
      parseEther("10"), parseUnits("500000", 6), 0, 0,
      deployer.address, await time.latest() + 600,
    )

    return { tokens, dexRouter, dexRouterAddress }
  }


  it("should deploy DEX successfully", async function () {
    await loadFixture(deployContracts)
  })


  it("should swap successfully on DEX", async function () {
    const { tokens, dexRouter, dexRouterAddress } = await loadFixture(deployContracts)
    const [_, __, user1] = await ethers.getSigners()

    // User-1 swap
    const btcbUser1Before = await tokens.mockBTCB.balanceOf(user1.address)
    const usdcUser1Before = await tokens.mockUSDC.balanceOf(user1.address)
    await tokens.mockBTCB.connect(user1).approve(dexRouterAddress, parseEther("1"))
    await tokens.mockUSDC.connect(user1).approve(dexRouterAddress, parseUnits("50000", 6))
    await dexRouter.connect(user1).swapExactTokensForTokens(
      parseEther("0.001"), 0,
      [await tokens.mockBTCB.getAddress(), await tokens.mockUSDC.getAddress()],
      user1.address, await time.latest() + 600,
    )
    const btcbUser1After1 = await tokens.mockBTCB.balanceOf(user1.address)
    const usdcUser1After1 = await tokens.mockUSDC.balanceOf(user1.address)
    const btcbUser1Delta1 = formatEther(btcbUser1Before - btcbUser1After1)
    const usdcUser1Delta1 = formatUnits(usdcUser1After1 - usdcUser1Before, 6)
    console.log(`\tUser-1 buy ${usdcUser1Delta1} $USDC with ${btcbUser1Delta1} $BTCB!`)

    // User-1 swap again
    await dexRouter.connect(user1).swapExactTokensForTokens(
      parseUnits("50000", 6), 0,
      [await tokens.mockUSDC.getAddress(), await tokens.mockBTCB.getAddress()],
      user1.address, await time.latest() + 600,
    )
    const btcbUser1After2 = await tokens.mockBTCB.balanceOf(user1.address)
    const usdcUser1After2 = await tokens.mockUSDC.balanceOf(user1.address)
    const btcbUser1Delta2 = formatEther(btcbUser1After2 - btcbUser1After1)
    const usdcUser1Delta2 = formatUnits(usdcUser1After1 - usdcUser1After2, 6)
    console.log(`\tUser-1 buy ${btcbUser1Delta2} $BTCB with ${usdcUser1Delta2} $USDC!`)

  })


  it("should execute swap successfully on Liquid Vault", async function () {
    const { tokens, dexRouter, dexRouterAddress } = await loadFixture(deployContracts)
    const [_owner, updater, user1, manager] = await ethers.getSigners()

    // Deploy liquid contracts
    const liquidOracle = (await upgrades.deployProxy(
      await ethers.getContractFactory("LiquidOracle")
    )) as unknown as LiquidOracle
    const liquidVault = (await upgrades.deployProxy(
      await ethers.getContractFactory("LiquidVault"),
      ["BTC Liquid Vault Share", "bSHARE"]
    )) as unknown as LiquidVault
    const liquidCashier = (await upgrades.deployProxy(
      await ethers.getContractFactory("LiquidCashier"),
      [await liquidVault.getAddress(), await liquidOracle.getAddress()]
    )) as unknown as LiquidCashier
    await liquidVault.setCashier(await liquidCashier.getAddress())
    await liquidVault.setLiquidityManager(manager.address, true)

    // Update prices
    const tokenAddresses = []
    for (const [_name, token] of Object.entries(tokens)) {
      await liquidOracle.addSupportedAsset(await token.getAddress())
      tokenAddresses.push(await token.getAddress())
    }
    tokenAddresses.push(await liquidOracle.STANDARD_ASSET())
    await liquidOracle.setPriceUpdater(updater.address, true)
    await liquidOracle.connect(updater).updatePrices([
      parseUnits("40000", 36 + 18 - 18),
      parseUnits("40000", 36 + 18 - 8),
      parseUnits("1.2", 36 + 18 - 6),
      parseUnits("1.2", 36 + 18 - 6),
      parseUnits("1.25", 36 + 18 - 18),
    ])

    // Add strategies on Vault
    /**
     * @notice Strategy 1. Approve $BTCB for uniswap router, at any amount.
     * 
     * to: [mockBTCB.address]
     * data: 0x095ea7b3 [approve.sig]
     * 000000000000000000000000c9a43158891282a2b1475592d5719c001986aaec [uniswap router address]
     * ________________________________________________________________ [any amount]
     */
    await liquidVault.addStrategy(
      await tokens.mockBTCB.getAddress(),
      "0xffffffff"
      + "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
      + "0000000000000000000000000000000000000000000000000000000000000000",
      "0x095ea7b3"
      + dexRouterAddress.slice(2).padStart(64, "0")
      + "0000000000000000000000000000000000000000000000000000000000000000",
      "Approve $BTCB for uniswap router, at any amount.",
    )
    await expect(liquidVault.addStrategy(await tokens.mockBTCB.getAddress(), "0xffff", "0xff", ""))
      .to.be.revertedWith("LIQUID_VAULT: length mismatch")

    /**
     * @notice Startegy 2. Approve $USDC for uniswap router, at any amount.
     */
    await liquidVault.addStrategy(
      await tokens.mockUSDC.getAddress(),
      "0xffffffff"
      + "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
      + "0000000000000000000000000000000000000000000000000000000000000000",
      "0x095ea7b3"
      + dexRouterAddress.slice(2).padStart(64, "0")
      + "0000000000000000000000000000000000000000000000000000000000000000",
      "Approve $USDC for uniswap router, at any amount.",
    )

    // Execute strategy: approve $BTCB for uniswap router
    await liquidVault.connect(manager).executeStrategy(
      0, tokens.mockBTCB.interface.encodeFunctionData("approve", [dexRouterAddress, parseEther("1")])
    )
    // Failed case 1: not liquiditiy manager
    await expect(liquidVault.connect(updater).executeStrategy(
      0, tokens.mockBTCB.interface.encodeFunctionData("approve", [dexRouterAddress, parseEther("1")])
    )).to.be.revertedWithCustomError(liquidVault, "AccessControlUnauthorizedAccount")
    // Failed case 2: invalid function
    await expect(liquidVault.connect(manager).executeStrategy(
      0, tokens.mockBTCB.interface.encodeFunctionData("transfer", [dexRouterAddress, parseEther("1")])
    )).to.be.revertedWith("LIQUID_VAULT: strategy not matched")
    // Failed case 3: invalid params
    await expect(liquidVault.connect(manager).executeStrategy(
      0, tokens.mockBTCB.interface.encodeFunctionData("approve", [user1.address, parseEther("1")])
    )).to.be.revertedWith("LIQUID_VAULT: strategy not matched")
    // Failed case 4: invalid length
    await expect(liquidVault.connect(manager).executeStrategy(
      0, tokens.mockBTCB.interface.encodeFunctionData("approve", [dexRouterAddress, parseEther("1")]) + "00"
    )).to.be.revertedWith("BYTES_BITWISE: length mismatch")

    /**
     * @notice Strategy 3. Swap $BTCB for $USDC on uniswap router, at any amount.
     * 
     * to: [uniswap router address]
     * data: 0x38ed1739 [swapExactTokensForTokens.sig]
     * ________________________________________________________________ [any amount] amountIn
     * ________________________________________________________________ [any amount] amountOutMin
     * 00000000000000000000000000000000000000000000000000000000000000a0 [0xa0] path.ref
     * 000000000000000000000000cace1b78160ae76398f486c8a18044da0d66d86d [vault address] to
     * ________________________________________________________________ [any time] deadline
     * 0000000000000000000000000000000000000000000000000000000000000002 [0x02] path.length
     * 0000000000000000000000001c85638e118b37167e9298c2268758e058ddfda0 [mockBTCB.address] path.0
     * 0000000000000000000000004c2f7092c2ae51d986befee378e50bd4db99c901 [mockUSDC.address] path.1
     */
    await liquidVault.addStrategy(
      dexRouterAddress,
      "0xffffffff"
      + "0000000000000000000000000000000000000000000000000000000000000000"
      + "0000000000000000000000000000000000000000000000000000000000000000"
      + "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
      + "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
      + "0000000000000000000000000000000000000000000000000000000000000000"
      + "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
      + "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
      + "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      "0x38ed1739"
      + "0000000000000000000000000000000000000000000000000000000000000000"
      + "0000000000000000000000000000000000000000000000000000000000000000"
      + "00000000000000000000000000000000000000000000000000000000000000a0"
      + (await liquidVault.getAddress()).slice(2).padStart(64, "0")
      + "0000000000000000000000000000000000000000000000000000000000000000"
      + "0000000000000000000000000000000000000000000000000000000000000002"
      + (await tokens.mockBTCB.getAddress()).slice(2).padStart(64, "0")
      + (await tokens.mockUSDC.getAddress()).slice(2).padStart(64, "0"),
      "Swap $BTCB for $USDC on uniswap router, at any amount.",
    )

    // User deposit $BTCB to vault
    await tokens.mockBTCB.connect(user1).approve(await liquidCashier.getAddress(), parseEther("1"))
    await liquidCashier.connect(user1).deposit(await tokens.mockBTCB.getAddress(), parseEther("0.1"))
    const btcbVaultBefore = await tokens.mockBTCB.balanceOf(await liquidVault.getAddress())
    const usdcVaultBefore = await tokens.mockUSDC.balanceOf(await liquidVault.getAddress())

    await liquidVault.connect(manager).executeStrategy(
      2, dexRouter.interface.encodeFunctionData("swapExactTokensForTokens", [
        parseEther("0.1"), 0,
        [await tokens.mockBTCB.getAddress(), await tokens.mockUSDC.getAddress()],
        await liquidVault.getAddress(), await time.latest() + 600,
      ])
    )

    const btcbVaultAfter = await tokens.mockBTCB.balanceOf(await liquidVault.getAddress())
    const usdcVaultAfter = await tokens.mockUSDC.balanceOf(await liquidVault.getAddress())
    const btcbVaultDelta = formatEther(btcbVaultBefore - btcbVaultAfter)
    const usdcVaultDelta = formatUnits(usdcVaultAfter - usdcVaultBefore, 6)
    console.log(`\tLiquid Manager buy ${usdcVaultDelta} $USDC with ${btcbVaultDelta} $BTCB on LiquidVault!`)

    // Test removing strategy
    await liquidVault.removeStrategy(1)

  })

})