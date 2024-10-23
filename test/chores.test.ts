import { expect } from "chai"
import { ethers } from "hardhat"
import { parseEther } from "ethers"

describe("test chores", function () {

  it("should pass WETH", async function () {
    const weth = await ethers.deployContract("MockWETH")
    const [alice] = await ethers.getSigners()

    const wethBefore = await weth.balanceOf(alice.address)
    const ethBefore = await ethers.provider.getBalance(alice.address)

    await weth.deposit({ value: parseEther("1") })

    expect(await weth.balanceOf(alice.address) - wethBefore).to.equal(parseEther("1"))
    expect(ethBefore - await ethers.provider.getBalance(alice.address))
      .to.be.closeTo(parseEther("1"), parseEther("0.01"))

    await weth.withdraw(parseEther("0.5"))

    expect(await weth.balanceOf(alice.address) - wethBefore).to.equal(parseEther("0.5"))
    expect(ethBefore - await ethers.provider.getBalance(alice.address))
      .to.be.closeTo(parseEther("0.5"), parseEther("0.01"))

  })

})