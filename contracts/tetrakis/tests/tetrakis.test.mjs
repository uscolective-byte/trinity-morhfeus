import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ganache from 'ganache';
import { ethers } from 'ethers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const contractsDir = path.resolve(__dirname, '..');
const artifactPath = path.join(contractsDir, 'build/TetrakisToken.json');

describe('Tetrakis ($TTK) ERC-20 Specification & EVM Verification Suite', () => {
  let provider;
  let deployer;
  let treasurySigner;
  let user1;
  let user2;
  let tokenContract;
  let artifact;

  const EXPECTED_TREASURY = '0x4d308452a96D7dAbFd2f33d92677A3a2724f387e';
  const EXPECTED_SUPPLY = 1_000_000_000n * 10n ** 18n; // 1 Billion * 10^18
  const MAX_UINT256 = ethers.MaxUint256;

  before(async () => {
    assert.ok(fs.existsSync(artifactPath), 'Artifact must exist before testing');
    artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

    // Start in-memory EVM provider using ganache (shanghai EVM compatible)
    const ganacheProvider = ganache.provider({
      wallet: {
        totalAccounts: 10,
        unlockedAccounts: [EXPECTED_TREASURY]
      },
      chain: {
        hardfork: 'shanghai'
      },
      logging: { quiet: true }
    });

    provider = new ethers.BrowserProvider(ganacheProvider);
    const signers = await provider.listAccounts();
    deployer = signers[0];
    user1 = signers[1];
    user2 = signers[2];

    // Fund treasury account with ETH for gas so it can transact in tests
    await deployer.sendTransaction({
      to: EXPECTED_TREASURY,
      value: ethers.parseEther('10.0')
    });

    treasurySigner = await provider.getSigner(EXPECTED_TREASURY);

    // Deploy contract
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
    tokenContract = await factory.deploy();
    await tokenContract.waitForDeployment();
  });

  test('Metadata: Name, Symbol, Decimals', async () => {
    assert.equal(await tokenContract.name(), 'Tetrakis');
    assert.equal(await tokenContract.symbol(), 'TTK');
    assert.equal(await tokenContract.decimals(), 18n);
  });

  test('Initial Allocation: 100% of supply minted to Official Treasury', async () => {
    const totalSupply = await tokenContract.totalSupply();
    assert.equal(totalSupply, EXPECTED_SUPPLY);

    const treasuryBal = await tokenContract.balanceOf(EXPECTED_TREASURY);
    assert.equal(treasuryBal, EXPECTED_SUPPLY);

    const deployerBal = await tokenContract.balanceOf(deployer.address);
    assert.equal(deployerBal, 0n);
  });

  test('Immutability: No post-minting functions in ABI', () => {
    const mintFunctions = artifact.abi.filter(
      item => item.type === 'function' && item.name && item.name.toLowerCase().includes('mint')
    );
    assert.equal(mintFunctions.length, 0, 'No external mint function should be exposed in ERC20 contract');
  });

  test('Transfer & Event: Treasury transfers tokens and emits Transfer event', async () => {
    const tokenFromTreasury = tokenContract.connect(treasurySigner);
    const transferAmount = 10_000_000n * 10n ** 18n; // 10 Million TTK

    const tx = await tokenFromTreasury.transfer(user1.address, transferAmount);
    const receipt = await tx.wait();
    assert.equal(receipt.status, 1);

    // Verify Transfer event
    const transferLogs = receipt.logs
      .map(log => {
        try { return tokenContract.interface.parseLog(log); } catch { return null; }
      })
      .filter(l => l && l.name === 'Transfer');

    assert.equal(transferLogs.length, 1);
    assert.equal(transferLogs[0].args[0].toLowerCase(), EXPECTED_TREASURY.toLowerCase());
    assert.equal(transferLogs[0].args[1].toLowerCase(), user1.address.toLowerCase());
    assert.equal(transferLogs[0].args[2], transferAmount);

    assert.equal(await tokenContract.balanceOf(user1.address), transferAmount);
    assert.equal(await tokenContract.balanceOf(EXPECTED_TREASURY), EXPECTED_SUPPLY - transferAmount);
  });

  test('Edge Case: Zero-value transfer succeeds and emits event', async () => {
    const tokenFromUser1 = tokenContract.connect(user1);
    const balBefore = await tokenContract.balanceOf(user1.address);

    const tx = await tokenFromUser1.transfer(user2.address, 0n);
    const receipt = await tx.wait();
    assert.equal(receipt.status, 1);

    const balAfter = await tokenContract.balanceOf(user1.address);
    assert.equal(balBefore, balAfter);
  });

  test('Edge Case: Self-transfer succeeds without changing balance', async () => {
    const tokenFromUser1 = tokenContract.connect(user1);
    const balBefore = await tokenContract.balanceOf(user1.address);

    const tx = await tokenFromUser1.transfer(user1.address, 1000n);
    await tx.wait();

    const balAfter = await tokenContract.balanceOf(user1.address);
    assert.equal(balBefore, balAfter);
  });

  test('Approval & Event: Approve spender and emit Approval event', async () => {
    const tokenFromUser1 = tokenContract.connect(user1);
    const approveAmount = 2_000_000n * 10n ** 18n;

    const tx = await tokenFromUser1.approve(user2.address, approveAmount);
    const receipt = await tx.wait();

    const approvalLogs = receipt.logs
      .map(log => {
        try { return tokenContract.interface.parseLog(log); } catch { return null; }
      })
      .filter(l => l && l.name === 'Approval');

    assert.equal(approvalLogs.length, 1);
    assert.equal(approvalLogs[0].args[0].toLowerCase(), user1.address.toLowerCase());
    assert.equal(approvalLogs[0].args[1].toLowerCase(), user2.address.toLowerCase());
    assert.equal(approvalLogs[0].args[2], approveAmount);

    const allowance = await tokenContract.allowance(user1.address, user2.address);
    assert.equal(allowance, approveAmount);
  });

  test('transferFrom: Spender transfers within allowance', async () => {
    const tokenFromUser2 = tokenContract.connect(user2);
    const spendAmount = 500_000n * 10n ** 18n;

    const tx = await tokenFromUser2.transferFrom(user1.address, user2.address, spendAmount);
    await tx.wait();

    assert.equal(await tokenContract.balanceOf(user2.address), spendAmount);
    const remainingAllowance = await tokenContract.allowance(user1.address, user2.address);
    assert.equal(remainingAllowance, 2_000_000n * 10n ** 18n - spendAmount);
  });

  test('Max Allowance Optimization: Infinite allowance does not decrease on transferFrom', async () => {
    const tokenFromUser1 = tokenContract.connect(user1);
    await (await tokenFromUser1.approve(user2.address, MAX_UINT256)).wait();

    const tokenFromUser2 = tokenContract.connect(user2);
    const spendAmount = 100_000n * 10n ** 18n;
    await (await tokenFromUser2.transferFrom(user1.address, user2.address, spendAmount)).wait();

    const currentAllowance = await tokenContract.allowance(user1.address, user2.address);
    assert.equal(currentAllowance, MAX_UINT256, 'Max uint256 allowance should remain infinite');
  });

  test('Negative: Transfer exceeding balance reverts', async () => {
    const tokenFromUser2 = tokenContract.connect(user2);
    const balance = await tokenContract.balanceOf(user2.address);
    const excessiveAmount = balance + 1000n;

    await assert.rejects(
      async () => {
        await tokenFromUser2.transfer.staticCall(user1.address, excessiveAmount);
      },
      /ERC20InsufficientBalance|CALL_EXCEPTION/
    );
  });

  test('Negative: Transfer to zero address reverts', async () => {
    const tokenFromUser1 = tokenContract.connect(user1);
    await assert.rejects(
      async () => {
        await tokenFromUser1.transfer.staticCall(ethers.ZeroAddress, 1000n);
      },
      /ERC20InvalidReceiver|CALL_EXCEPTION/
    );
  });

  test('Negative: Approve to zero address reverts', async () => {
    const tokenFromUser1 = tokenContract.connect(user1);
    await assert.rejects(
      async () => {
        await tokenFromUser1.approve.staticCall(ethers.ZeroAddress, 1000n);
      },
      /ERC20InvalidSpender|CALL_EXCEPTION/
    );
  });

  test('Negative: transferFrom exceeding allowance reverts', async () => {
    // Reset allowance to small number
    const tokenFromUser1 = tokenContract.connect(user1);
    await (await tokenFromUser1.approve(user2.address, 500n)).wait();

    const tokenFromUser2 = tokenContract.connect(user2);
    await assert.rejects(
      async () => {
        await tokenFromUser2.transferFrom.staticCall(user1.address, user2.address, 1000n);
      },
      /ERC20InsufficientAllowance|CALL_EXCEPTION/
    );
  });

  test('Conservation Invariant: Total supply is perfectly invariant throughout all operations', async () => {
    const totalSupply = await tokenContract.totalSupply();
    assert.equal(totalSupply, EXPECTED_SUPPLY);
  });
});
