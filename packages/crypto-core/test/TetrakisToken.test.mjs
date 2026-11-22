import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

const BASTERIX = "0x7e17f9072cfCbc7fE45973De0F11eC8db99281e4";
const TREASURY = "0x4d308452a96D7dAbFd2f33d92677A3a2724f387e";
const E18 = 10n ** 18n;
const SUPPLY = 1_000_000_000n * E18;

describe("TetrakisToken ($TTK) - canonical fixed supply, no mint", function () {
  let token, deployer, alice, bob;

  beforeEach(async function () {
    [deployer, alice, bob] = await ethers.getSigners();
    token = await (await ethers.getContractFactory("TetrakisToken")).deploy();
    await token.waitForDeployment();
    // Treasury is an EOA whose key we do not hold: impersonate it on the local hardhat chain only.
    await ethers.provider.send("hardhat_setBalance", [TREASURY, "0x56BC75E2D63100000"]);
  });

  async function asTreasury() {
    await ethers.provider.send("hardhat_impersonateAccount", [TREASURY]);
    return ethers.getSigner(TREASURY);
  }

  it("has the expected metadata", async function () {
    expect(await token.name()).to.equal("Tetrakis");
    expect(await token.symbol()).to.equal("TTK");
    expect(await token.decimals()).to.equal(18n);
  });

  it("has a fixed total supply of exactly 1,000,000,000 TTK", async function () {
    expect(await token.totalSupply()).to.equal(SUPPLY);
    expect(await token.TOTAL_SUPPLY_CAP()).to.equal(SUPPLY);
  });

  it("splits supply 1,000,000 TTK to Basterix and 999,000,000 TTK to the treasury; deployer gets nothing", async function () {
    expect(await token.balanceOf(BASTERIX)).to.equal(1_000_000n * E18);
    expect(await token.balanceOf(TREASURY)).to.equal(999_000_000n * E18);
    expect(await token.balanceOf(deployer.address)).to.equal(0n);
  });

  it("emits Transfer events from the zero address for the initial allocations", async function () {
    const receipt = await token.deploymentTransaction().wait();
    const transfers = receipt.logs.map((l) => token.interface.parseLog(l)).filter((l) => l && l.name === "Transfer");
    expect(transfers.map((t) => [t.args.from, t.args.to, t.args.value])).to.deep.equal([
      [ethers.ZeroAddress, BASTERIX, 1_000_000n * E18],
      [ethers.ZeroAddress, TREASURY, 999_000_000n * E18],
    ]);
  });

  it("exposes no mint, burn, pause, blacklist, owner or upgrade entry points", async function () {
    const names = token.interface.fragments.filter((f) => f.type === "function").map((f) => f.name.toLowerCase());
    for (const forbidden of ["mint", "burn", "pause", "unpause", "blacklist", "owner", "transferownership", "upgradeto", "setfee"]) {
      expect(names, `unexpected function ${forbidden}`).to.not.include(forbidden);
    }
  });

  it("transfers tokens, conserves total supply and emits Transfer", async function () {
    const t = await asTreasury();
    await expect(token.connect(t).transfer(alice.address, 123n * E18))
      .to.emit(token, "Transfer").withArgs(TREASURY, alice.address, 123n * E18);
    expect(await token.balanceOf(alice.address)).to.equal(123n * E18);
    expect(await token.balanceOf(TREASURY)).to.equal(999_000_000n * E18 - 123n * E18);
    expect(await token.totalSupply()).to.equal(SUPPLY);
  });

  it("supports approve + transferFrom within the allowance and reverts beyond it", async function () {
    const t = await asTreasury();
    await token.connect(t).approve(alice.address, 50n * E18);
    await token.connect(alice).transferFrom(TREASURY, bob.address, 30n * E18);
    expect(await token.allowance(TREASURY, alice.address)).to.equal(20n * E18);
    expect(await token.balanceOf(bob.address)).to.equal(30n * E18);
    await expect(token.connect(alice).transferFrom(TREASURY, bob.address, 21n * E18))
      .to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
  });

  it("reverts when transferring more than the balance", async function () {
    await expect(token.connect(alice).transfer(bob.address, 1n))
      .to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
  });

  it("reverts when transferring to the zero address", async function () {
    const t = await asTreasury();
    await expect(token.connect(t).transfer(ethers.ZeroAddress, 1n))
      .to.be.revertedWithCustomError(token, "ERC20InvalidReceiver");
  });

  it("total supply stays constant after many transfers", async function () {
    const t = await asTreasury();
    await token.connect(t).transfer(alice.address, 7n * E18);
    await token.connect(alice).transfer(bob.address, 3n * E18);
    await token.connect(bob).transfer(TREASURY, 1n * E18);
    const sum = (await token.balanceOf(BASTERIX)) + (await token.balanceOf(TREASURY)) +
      (await token.balanceOf(alice.address)) + (await token.balanceOf(bob.address));
    expect(sum).to.equal(SUPPLY);
    expect(await token.totalSupply()).to.equal(SUPPLY);
  });
});
