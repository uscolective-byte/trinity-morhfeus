const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const pkgRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(pkgRoot, "../..");
const tetrakisNodeModules = path.join(repoRoot, "contracts/tetrakis/node_modules");

function resolveDep(modName) {
  try {
    return require(modName);
  } catch {
    return require(path.join(tetrakisNodeModules, modName));
  }
}

const solc = resolveDep("solc");
const { ethers } = resolveDep("ethers");

function compileTetrakisToken() {
  const sourcePath = path.join(pkgRoot, "contracts/TetrakisToken.sol");
  const sourceCode = fs.readFileSync(sourcePath, "utf8").replace(/\r\n/g, "\n");

  const input = {
    language: "Solidity",
    sources: {
      "contracts/TetrakisToken.sol": {
        content: sourceCode,
      },
    },
    settings: {
      evmVersion: "shanghai",
      optimizer: {
        enabled: true,
        runs: 200,
      },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode", "evm.deployedBytecode", "metadata"],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    let hasError = false;
    for (const err of output.errors) {
      if (err.severity === "error") {
        console.error(err.formattedMessage);
        hasError = true;
      } else {
        console.warn(err.formattedMessage);
      }
    }
    if (hasError) {
      process.exit(1);
    }
  }

  const compiled = output.contracts["contracts/TetrakisToken.sol"]["TetrakisToken"];
  const bytecode = "0x" + compiled.evm.bytecode.object;
  const deployedBytecode = "0x" + compiled.evm.deployedBytecode.object;
  const bytecodeSha256 = "0x" + crypto.createHash("sha256").update(Buffer.from(compiled.evm.bytecode.object, "hex")).digest("hex");
  const deployedBytecodeSha256 = "0x" + crypto.createHash("sha256").update(Buffer.from(compiled.evm.deployedBytecode.object, "hex")).digest("hex");
  const runtimeKeccak256 = ethers.keccak256(deployedBytecode);

  const hhArtifactDir = path.join(pkgRoot, "artifacts/contracts/TetrakisToken.sol");
  fs.mkdirSync(hhArtifactDir, { recursive: true });
  const hhArtifactPath = path.join(hhArtifactDir, "TetrakisToken.json");

  const artifact = {
    _format: "hh-sol-artifact-1",
    contractName: "TetrakisToken",
    sourceName: "contracts/TetrakisToken.sol",
    compiler: solc.version(),
    compilerSettings: {
      evmVersion: "shanghai",
      optimizer: { enabled: true, runs: 200 },
    },
    abi: compiled.abi,
    bytecode,
    deployedBytecode,
    bytecodeSha256,
    deployedBytecodeSha256,
    runtimeKeccak256,
    linkReferences: {},
    deployedLinkReferences: {},
  };

  fs.writeFileSync(hhArtifactPath, JSON.stringify(artifact, null, 2) + "\n", "utf8");

  const buildDir = path.join(pkgRoot, "build");
  fs.mkdirSync(buildDir, { recursive: true });
  fs.writeFileSync(path.join(buildDir, "TetrakisToken.json"), JSON.stringify(artifact, null, 2) + "\n", "utf8");

  return artifact;
}

if (require.main === module) {
  const artifact = compileTetrakisToken();
  console.log(`[CRYPTO-CORE] Compiled TetrakisToken.sol (${artifact.compiler})`);
  console.log(`  Bytecode SHA-256:  ${artifact.bytecodeSha256}`);
  console.log(`  Runtime Keccak256: ${artifact.runtimeKeccak256}`);
}

module.exports = { compileTetrakisToken, resolveDep };
