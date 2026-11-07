import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import solc from '../contracts/tetrakis/node_modules/solc/index.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const tetrakisDir = path.resolve(root, 'contracts/tetrakis');
const sourcePath = path.resolve(tetrakisDir, 'TetrakisToken.sol');
const sourceCode = fs.readFileSync(sourcePath, 'utf8').replace(/\r\n/g, '\n');

function findImports(importPath) {
  try {
    if (importPath.startsWith('@openzeppelin/')) {
      const resolvedPath = path.resolve(tetrakisDir, 'node_modules', importPath);
      if (fs.existsSync(resolvedPath)) {
        return { contents: fs.readFileSync(resolvedPath, 'utf8').replace(/\r\n/g, '\n') };
      }
    }
    const localPath = path.resolve(tetrakisDir, importPath);
    if (fs.existsSync(localPath)) {
      return { contents: fs.readFileSync(localPath, 'utf8').replace(/\r\n/g, '\n') };
    }
    return { error: `File not found: ${importPath}` };
  } catch (err) {
    return { error: err.message };
  }
}

function compileWith(settings) {
  const input = {
    language: 'Solidity',
    sources: {
      'TetrakisToken.sol': { content: sourceCode }
    },
    settings
  };
  const rawOutput = solc.compile(JSON.stringify(input), { import: findImports });
  return JSON.parse(rawOutput);
}

test('tetrakis compiles under unoptimized constraints and respects EIP-170 size limit', () => {
  const output = compileWith({
    evmVersion: 'shanghai',
    optimizer: { enabled: false },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode'] } }
  });

  const hasErrors = Boolean(output.errors?.some(e => e.severity === 'error'));
  assert.equal(hasErrors, false, 'Compilation had errors');
  const contract = output.contracts['TetrakisToken.sol']['TetrakisToken'];
  const deployedBytes = Buffer.from(contract.evm.deployedBytecode.object, 'hex');
  
  // EIP-170 max code size is 24576 bytes
  assert.ok(deployedBytes.length < 24576, `Deployed bytecode size ${deployedBytes.length} exceeds EIP-170 24576 bytes`);
  assert.equal(deployedBytes.length, 3910, 'Unoptimized deployed bytecode expected size is 3910 bytes');
});

test('tetrakis compiles across multiple EVM target versions (shanghai, cancun, paris, london)', () => {
  const targets = ['shanghai', 'cancun', 'paris', 'london'];
  for (const evmVersion of targets) {
    const output = compileWith({
      evmVersion,
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode'] } }
    });

    const hasErrors = Boolean(output.errors?.some(e => e.severity === 'error'));
    assert.equal(hasErrors, false, `Compilation failed for EVM version ${evmVersion}`);
    const contract = output.contracts['TetrakisToken.sol']['TetrakisToken'];
    assert.ok(contract.evm.bytecode.object.length > 0);
    assert.ok(contract.evm.deployedBytecode.object.length > 0);
  }
});

test('tetrakis compiles under extreme optimization runs (runs=1 and runs=1,000,000)', () => {
  for (const runs of [1, 1000000]) {
    const output = compileWith({
      evmVersion: 'shanghai',
      optimizer: { enabled: true, runs },
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode'] } }
    });

    const hasErrors = Boolean(output.errors?.some(e => e.severity === 'error'));
    assert.equal(hasErrors, false, `Compilation failed for runs=${runs}`);
    const contract = output.contracts['TetrakisToken.sol']['TetrakisToken'];
    assert.ok(contract.evm.deployedBytecode.object.length > 0);
  }
});

test('import resolver gracefully reports errors for nonexistent imports', () => {
  const missingOZ = findImports('@openzeppelin/contracts/token/ERC20/NonExistent.sol');
  assert.ok(missingOZ.error, 'Must report error for missing OpenZeppelin import');

  const missingLocal = findImports('nonexistent_local_contract.sol');
  assert.ok(missingLocal.error, 'Must report error for missing local import');
});

test('tetrakis ABI is completely immutable and contains zero administrative or mint functions', () => {
  const output = compileWith({
    evmVersion: 'shanghai',
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['abi'] } }
  });

  const abi = output.contracts['TetrakisToken.sol']['TetrakisToken'].abi;
  const functionNames = abi.filter(item => item.type === 'function').map(f => f.name);

  // Check expected public functions
  const expected = [
    'name', 'symbol', 'decimals', 'totalSupply', 'balanceOf',
    'transfer', 'allowance', 'approve', 'transferFrom',
    'BASTERIX_WALLET', 'INITIAL_TREASURY', 'BASTERIX_ALLOCATION',
    'TREASURY_ALLOCATION', 'TOTAL_SUPPLY_CAP'
  ];
  for (const name of expected) {
    assert.ok(functionNames.includes(name), `Missing expected function ${name}`);
  }

  // Strictly forbid any mutable admin functions
  const forbidden = ['mint', 'burn', 'pause', 'unpause', 'setOwner', 'transferOwnership', 'upgradeTo'];
  for (const name of forbidden) {
    assert.ok(!functionNames.includes(name), `Forbidden function ${name} detected in ABI!`);
  }
});

test('compiler output is strictly deterministic', () => {
  const compile = () => compileWith({
    evmVersion: 'shanghai',
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['evm.deployedBytecode'] } }
  });

  const res1 = compile();
  const res2 = compile();

  const code1 = res1.contracts['TetrakisToken.sol']['TetrakisToken'].evm.deployedBytecode.object;
  const code2 = res2.contracts['TetrakisToken.sol']['TetrakisToken'].evm.deployedBytecode.object;

  assert.equal(code1, code2, 'Solidity compiler output is not deterministic');
});
