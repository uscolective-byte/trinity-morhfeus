import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import solc from 'solc';
import { ethers } from 'ethers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const contractsDir = path.resolve(__dirname, '..');

const sourcePath = path.join(contractsDir, 'TetrakisToken.sol');
const sourceCode = fs.readFileSync(sourcePath, 'utf8');

function findImports(importPath) {
  try {
    if (importPath.startsWith('@openzeppelin/')) {
      const resolvedPath = path.resolve(contractsDir, 'node_modules', importPath);
      if (fs.existsSync(resolvedPath)) {
        return { contents: fs.readFileSync(resolvedPath, 'utf8') };
      }
    }
    const localPath = path.resolve(contractsDir, importPath);
    if (fs.existsSync(localPath)) {
      return { contents: fs.readFileSync(localPath, 'utf8') };
    }
    return { error: `File not found: ${importPath}` };
  } catch (err) {
    return { error: err.message };
  }
}

const input = {
  language: 'Solidity',
  sources: {
    'TetrakisToken.sol': {
      content: sourceCode
    }
  },
  settings: {
    evmVersion: 'shanghai',
    optimizer: {
      enabled: true,
      runs: 200
    },
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode', 'metadata']
      }
    }
  }
};

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

if (output.errors) {
  let hasErrors = false;
  for (const error of output.errors) {
    if (error.severity === 'error') {
      console.error(error.formattedMessage);
      hasErrors = true;
    } else {
      console.warn(error.formattedMessage);
    }
  }
  if (hasErrors) {
    console.error('Compilation failed with errors.');
    process.exit(1);
  }
}

const contract = output.contracts['TetrakisToken.sol']['TetrakisToken'];
const bytecodeHex = '0x' + contract.evm.bytecode.object;
const deployedBytecodeHex = '0x' + contract.evm.deployedBytecode.object;

const bytecodeSha256 = '0x' + crypto.createHash('sha256').update(Buffer.from(contract.evm.bytecode.object, 'hex')).digest('hex');
const deployedBytecodeSha256 = '0x' + crypto.createHash('sha256').update(Buffer.from(contract.evm.deployedBytecode.object, 'hex')).digest('hex');
const runtimeKeccak256 = ethers.keccak256(deployedBytecodeHex);

const artifact = {
  contractName: 'TetrakisToken',
  standard: 'OpenZeppelin ERC20 v5.1.0',
  compiler: solc.version(),
  compilerSettings: {
    evmVersion: 'shanghai',
    optimizer: {
      enabled: true,
      runs: 200
    }
  },
  abi: contract.abi,
  bytecode: bytecodeHex,
  deployedBytecode: deployedBytecodeHex,
  bytecodeSha256,
  deployedBytecodeSha256,
  runtimeKeccak256,
  compiledAt: new Date().toISOString()
};

const outDir = path.join(contractsDir, 'build');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(path.join(outDir, 'TetrakisToken.json'), JSON.stringify(artifact, null, 2));
console.log('Successfully compiled TetrakisToken (OpenZeppelin v5.1.0) to contracts/tetrakis/build/TetrakisToken.json');
console.log('Compiler:               ', artifact.compiler);
console.log('EVM Version:            ', artifact.compilerSettings.evmVersion);
console.log('Bytecode Size:          ', (bytecodeHex.length - 2) / 2, 'bytes');
console.log('Deployed Bytecode Size: ', (deployedBytecodeHex.length - 2) / 2, 'bytes');
console.log('Runtime Keccak256:      ', runtimeKeccak256);

