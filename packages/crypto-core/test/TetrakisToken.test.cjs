const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TetrakisToken ($TTK) Sovereign Audit", function () {
  let token, owner, worker, user1;
  const INITIAL_SUPPLY = 2_000_000; // 2M TTK v prvotnom obehu

  beforeEach(async function () {
    [owner, worker, user1] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("TetrakisToken");
    token = await Factory.deploy(worker.address, INITIAL_SUPPLY);
    await token.waitForDeployment();
  });

  it("Nastaví korektný počiatočný balance a Hard Cap", async function () {
    const ownerBal = await token.balanceOf(owner.address);
    expect(ownerBal).to.equal(ethers.parseEther("2000000"));

    const cap = await token.HARD_CAP();
    expect(cap).to.equal(ethers.parseEther("10000000"));

    expect(await token.name()).to.equal("Tetrakis");
    expect(await token.symbol()).to.equal("TTK");
    expect(await token.decimals()).to.equal(18n);
    expect(await token.sovereignOwner()).to.equal(owner.address);
    expect(await token.treasuryWorker()).to.equal(worker.address);
  });

  it("Zabráni nepovolenému mintovaniu bez Ring 0 práv", async function () {
    await expect(
      token.connect(user1).mint(user1.address, ethers.parseEther("100"))
    ).to.be.revertedWith("ERR_RING0_SOVEREIGN_ONLY");
  });

  it("Zabráni prekročeniu Hard Capu (10M TTK)", async function () {
    // Pokus vytlačiť 9 miliónov nad existujúce 2 milióny (spolu 11M > 10M)
    await expect(
      token.connect(owner).mint(owner.address, ethers.parseEther("9000000"))
    ).to.be.revertedWith("ERR_CAP_EXCEEDED");
  });

  it("Umožní Ring 0 mint do výšky Hard Capu a spálenie tokenov (burn)", async function () {
    await (await token.connect(owner).mint(user1.address, ethers.parseEther("500000"))).wait();
    expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther("500000"));
    expect(await token.totalSupply()).to.equal(ethers.parseEther("2500000"));

    await (await token.connect(user1).burn(ethers.parseEther("100000"))).wait();
    expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther("400000"));
    expect(await token.totalSupply()).to.equal(ethers.parseEther("2400000"));
  });

  it("Podporuje štandardné ERC-20 transfer, approve a transferFrom operácie", async function () {
    await (await token.connect(owner).transfer(user1.address, ethers.parseEther("1000"))).wait();
    expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther("1000"));

    await (await token.connect(user1).approve(worker.address, ethers.parseEther("400"))).wait();
    expect(await token.allowance(user1.address, worker.address)).to.equal(ethers.parseEther("400"));

    await (await token.connect(worker).transferFrom(user1.address, owner.address, ethers.parseEther("250"))).wait();
    expect(await token.allowance(user1.address, worker.address)).to.equal(ethers.parseEther("150"));
    expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther("750"));
  });

  it("Chráni updateTreasuryWorker a transferSovereignOwnership pomocou onlySovereign", async function () {
    await expect(
      token.connect(user1).updateTreasuryWorker(user1.address)
    ).to.be.revertedWith("ERR_RING0_SOVEREIGN_ONLY");

    await (await token.connect(owner).updateTreasuryWorker(user1.address)).wait();
    expect(await token.treasuryWorker()).to.equal(user1.address);

    await expect(
      token.connect(user1).transferSovereignOwnership(user1.address)
    ).to.be.revertedWith("ERR_RING0_SOVEREIGN_ONLY");

    await (await token.connect(owner).transferSovereignOwnership(user1.address)).wait();
    expect(await token.sovereignOwner()).to.equal(user1.address);
  });
});
