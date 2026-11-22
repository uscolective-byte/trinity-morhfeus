const fs = require("node:fs");
const path = require("node:path");
const { expect } = require("chai");

// Guards against the previous situation where two diverging contract versions existed in the repository.
describe("single canonical contract source", function () {
  const read = (p) => fs.readFileSync(path.resolve(__dirname, p), "utf8").replace(/\r\n/g, "\n");

  it("packages/crypto-core copy is byte-identical to contracts/tetrakis/TetrakisToken.sol", function () {
    expect(read("../contracts/TetrakisToken.sol")).to.equal(read("../../../contracts/tetrakis/TetrakisToken.sol"));
  });

  it("no second TetrakisToken.sol exists at contracts/TetrakisToken.sol", function () {
    expect(fs.existsSync(path.resolve(__dirname, "../../../contracts/TetrakisToken.sol"))).to.equal(false);
  });

  it("source declares fixed supply and no mint function", function () {
    const src = read("../contracts/TetrakisToken.sol");
    expect(src).to.match(/TOTAL_SUPPLY_CAP = 1_000_000_000 \* 10 \*\* 18/);
    expect(src).to.not.match(/function\s+mint\s*\(/);
  });
});
