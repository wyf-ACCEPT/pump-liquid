import { expect } from "chai"
import { ethers, upgrades } from "hardhat"
import { parseEther, parseUnits } from "ethers"
import { LiquidCashier, LiquidFactory, LiquidOracle, LiquidVault, UpgradeableBeacon } from "../typechain-types"
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { deployTokens } from "../scripts/utils"

describe("test factory", function () {

  async function deployContracts() {
    const [_, btcVaultOwner, ethVaultOwner] = await ethers.getSigners()

    const vaultImpl = await ethers.deployContract("LiquidVault")
    const oracleImpl = await ethers.deployContract("LiquidOracle")
    const cashierImpl = await ethers.deployContract("LiquidCashier")
    const liquidFactoryOfFactory = await ethers.getContractFactory("LiquidFactory")
    const liquidFactory = await upgrades.deployProxy(liquidFactoryOfFactory, [
      await vaultImpl.getAddress(), await oracleImpl.getAddress(), await cashierImpl.getAddress(),
    ]) as unknown as LiquidFactory

    await liquidFactory.deployLiquid("BTC Vault Share", "lvBTC", btcVaultOwner.address)
    await liquidFactory.deployLiquid("ETH Vault Share", "lvETH", ethVaultOwner.address)

    const weth = await ethers.deployContract("MockWETH")
    await weth.deposit({ value: parseEther("1") })
    const tokens = { weth, ... await deployTokens() }

    return { liquidFactory, tokens }
  }


  it("should deploy the contract correctly", async function () {
    const { liquidFactory, tokens } = await loadFixture(deployContracts)
    expect(await liquidFactory.getLiquidsNum()).to.equal(2)
    expect(Object.keys(tokens).length).to.equal(5)
  })


  it("should upgrade the contract correctly", async function () {
    const { liquidFactory } = await loadFixture(deployContracts)

    // Deploy new implementation contract of `LiquidVault`
    const vaultImplNew = await ethers.deployContract("LiquidVault")
    const vaultBeacon = await ethers.getContractAt(
      "UpgradeableBeacon", await liquidFactory.beaconVault()
    ) as unknown as UpgradeableBeacon

    // Wrong way to upgrade
    await expect(vaultBeacon.upgradeTo(await vaultImplNew.getAddress()))
      .to.be.revertedWithCustomError(vaultBeacon, "OwnableUnauthorizedAccount")

    // Correct way to upgrade
    await liquidFactory.upgradeVault(await vaultImplNew.getAddress())
    expect(await liquidFactory.getImplementationVault())
      .to.equal(await vaultImplNew.getAddress())

    // Upgrade other contracts
    const oracleImplNew = await ethers.deployContract("LiquidOracle")
    const cashierImplNew = await ethers.deployContract("LiquidCashier")
    await liquidFactory.upgradeOracle(await oracleImplNew.getAddress())
    await liquidFactory.upgradeCashier(await cashierImplNew.getAddress())
    expect(await liquidFactory.getImplementationOracle())
      .to.equal(await oracleImplNew.getAddress())
    expect(await liquidFactory.getImplementationCashier())
      .to.equal(await cashierImplNew.getAddress())
  })

  
  it("should pass factory journey", async function () {
    const { liquidFactory, tokens } = await loadFixture(deployContracts)
    const [
      _, btcVaultOwner, ethVaultOwner,
      btcPriceUpdater, ethPriceUpdater,
      user1, _user2,
    ] = await ethers.getSigners()

    // Add supported assets
    const [_1, _2, _btcVaultAddr, btcOracleAddr, btcCasiherAddr] = await liquidFactory.liquids(0)
    const [_3, _4, ethVaultAddr, ethOracleAddr, ethCasiherAddr] = await liquidFactory.liquids(1)

    const btcOracle = await ethers.getContractAt(
      "LiquidOracle", btcOracleAddr
    ) as unknown as LiquidOracle
    
    const ethVault = await ethers.getContractAt(
      "LiquidVault", ethVaultAddr
    ) as unknown as LiquidVault
    const ethOracle = await ethers.getContractAt(
      "LiquidOracle", ethOracleAddr
    ) as unknown as LiquidOracle
    const ethCashier = await ethers.getContractAt(
      "LiquidCashier", ethCasiherAddr
    ) as unknown as LiquidCashier

    await expect(btcOracle.addSupportedAsset(await tokens.mockBTCB.getAddress()))
      .to.be.revertedWithCustomError(btcOracle, "AccessControlUnauthorizedAccount")

    await btcOracle.connect(btcVaultOwner).addSupportedAsset(await tokens.mockBTCB.getAddress())
    await btcOracle.connect(btcVaultOwner).addSupportedAsset(await tokens.mockWBTC.getAddress())
    await ethOracle.connect(ethVaultOwner).addSupportedAsset(await tokens.weth.getAddress())

    // Update price
    await btcOracle.connect(btcVaultOwner).setPriceUpdater(btcPriceUpdater.address, true)
    await expect(btcOracle.updatePrices([1, 1, 1]))
      .to.be.revertedWithCustomError(btcOracle, "AccessControlUnauthorizedAccount")
    await btcOracle.connect(btcPriceUpdater).updatePrices([
      parseUnits("50000", 36 + 18 - 18),
      parseUnits("50000", 36 + 18 - 8),
      parseUnits("1.25", 36 + 18 - 18),
    ])
    await ethOracle.connect(ethVaultOwner).setPriceUpdater(ethPriceUpdater.address, true)
    await ethOracle.connect(ethPriceUpdater).updatePrices([
      parseUnits("2500", 36 + 18 - 18),
      parseUnits("2.0", 36 + 18 - 18),
    ])

    expect(await btcOracle.fetchShareStandardPrice())
      .to.equal(parseUnits("0.8", 36 + 18 - 18))
    expect(await ethOracle.fetchShareStandardPrice())
      .to.equal(parseUnits("0.5", 36 + 18 - 18))

    // Deposit
    await tokens.weth.connect(user1).deposit({ value: parseEther("1") })
    await tokens.weth.connect(user1).approve(ethCasiherAddr, parseEther("1"))
    await expect(ethCashier.connect(user1).deposit(
      await tokens.mockBTCB.getAddress(), parseEther("1"))
    ).to.be.revertedWith("LIQUID_ORACLE: asset not found")
    await ethCashier.connect(user1).deposit(await tokens.weth.getAddress(), parseEther("1"))
    expect(await tokens.weth.balanceOf(ethVaultAddr)).to.equal(parseEther("1"))
    expect(await ethVault.balanceOf(user1.address)).to.equal(parseEther("2500"))

  })

})