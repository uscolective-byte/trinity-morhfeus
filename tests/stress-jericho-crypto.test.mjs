import test from 'node:test';
import assert from 'node:assert/strict';
import { keccak_256, keccak_512, keccak_384, keccak_224, sha3_256, sha3_512, shake128, shake256 } from '../Jericho-Worker/node_modules/@noble/hashes/sha3.js';
import { toChecksumAddress, deriveTrinityTreasury } from '../Jericho-Worker/src/crypto-engine.js';

function toHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

test('Keccak-256 standard vectors (NIST / Ethereum test vectors)', () => {
  // Empty string
  const emptyHash = toHex(keccak_256(new Uint8Array(0)));
  assert.equal(emptyHash, 'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');

  // "abc"
  const abcHash = toHex(keccak_256(new TextEncoder().encode('abc')));
  assert.equal(abcHash, '4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45');

  // Multi-block message: 136 bytes (Keccak-256 block rate is 1088 bits = 136 bytes)
  const block136 = new Uint8Array(136).fill(0x61); // 136 'a's
  const hash136 = toHex(keccak_256(block136));
  assert.equal(typeof hash136, 'string');
  assert.equal(hash136.length, 64);

  // Boundary checks: 135 bytes, 136 bytes, 137 bytes
  for (const len of [1, 32, 64, 135, 136, 137, 200, 1024, 65536]) {
    const data = new Uint8Array(len).fill(0x42);
    const h = keccak_256(data);
    assert.equal(h.length, 32, `Hash length for input len ${len} must be 32 bytes`);
  }
});

test('SHA3 family functions from @noble/hashes/sha3.js execute correctly', () => {
  const input = new TextEncoder().encode('Trinity-Jericho-2026');
  
  const k224 = keccak_224(input);
  assert.equal(k224.length, 28);
  
  const k256 = keccak_256(input);
  assert.equal(k256.length, 32);

  const k384 = keccak_384(input);
  assert.equal(k384.length, 48);

  const k512 = keccak_512(input);
  assert.equal(k512.length, 64);

  const s256 = sha3_256(input);
  assert.equal(s256.length, 32);

  const s512 = sha3_512(input);
  assert.equal(s512.length, 64);

  // Variable output length SHAKE
  const sk128 = shake128(input, { dkLen: 64 });
  assert.equal(sk128.length, 64);

  const sk256 = shake256(input, { dkLen: 128 });
  assert.equal(sk256.length, 128);
});

test('EIP-55 toChecksumAddress validates standard Ethereum test vectors', () => {
  const vectors = [
    {
      lower: '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed',
      checksum: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
    },
    {
      lower: '0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359',
      checksum: '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359'
    },
    {
      lower: '0xdbf03b407c01e7cd3cbea99509d93f8dddc8c6fb',
      checksum: '0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB'
    },
    {
      lower: '0xd1220a0cf47c7b9be7a2e6ba89f429762e7b9adb',
      checksum: '0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb'
    }
  ];

  for (const { lower, checksum } of vectors) {
    assert.equal(toChecksumAddress(lower), checksum);
    assert.equal(toChecksumAddress(checksum), checksum);
    assert.equal(toChecksumAddress(lower.toUpperCase()), checksum);
    assert.equal(toChecksumAddress(lower.replace('0x', '')), checksum);
  }
});

test('deriveTrinityTreasury generates deterministic EVM addresses under stress', () => {
  // Default and special seeds
  const defaultTreasury = deriveTrinityTreasury();
  assert.equal(defaultTreasury.evm_address, '0x4d308452a96D7dAbFd2f33d92677A3a2724f387e');
  
  const v1Treasury = deriveTrinityTreasury('trinity-jericho-treasury-v1');
  assert.equal(v1Treasury.evm_address, '0x4d308452a96D7dAbFd2f33d92677A3a2724f387e');

  const vaultTreasury = deriveTrinityTreasury('trinity-jericho-vault');
  assert.equal(vaultTreasury.evm_address, '0x4d308452a96D7dAbFd2f33d92677A3a2724f387e');

  // Determinism and uniqueness across 50 random seeds
  const seenAddresses = new Set();
  for (let i = 0; i < 50; i++) {
    const seed = `adversarial-seed-${i}-${Math.random()}`;
    const firstRun = deriveTrinityTreasury(seed);
    const secondRun = deriveTrinityTreasury(seed);
    
    // Deterministic check
    assert.equal(firstRun.evm_address, secondRun.evm_address);
    assert.match(firstRun.evm_address, /^0x[0-9a-fA-F]{40}$/);
    
    // Checksum verification
    assert.equal(toChecksumAddress(firstRun.evm_address), firstRun.evm_address);
    
    // Uniqueness
    assert.ok(!seenAddresses.has(firstRun.evm_address), 'Seed collisions detected');
    seenAddresses.add(firstRun.evm_address);
  }

  // Stress with complex unicode and large seed
  const unicodeSeed = '⚡🔱Trinity-Antigravity-✨-2026-🔒-🚀';
  const unicodeTreasury = deriveTrinityTreasury(unicodeSeed);
  assert.match(unicodeTreasury.evm_address, /^0x[0-9a-fA-F]{40}$/);

  const largeSeed = 'A'.repeat(100000);
  const largeTreasury = deriveTrinityTreasury(largeSeed);
  assert.match(largeTreasury.evm_address, /^0x[0-9a-fA-F]{40}$/);
});
