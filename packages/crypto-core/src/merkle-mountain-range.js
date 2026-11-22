import { keccak_256 } from '@noble/hashes/sha3.js';

const encoder = new TextEncoder();

function hexToBytes(value) {
  if (typeof value !== 'string') throw new TypeError('Hash must be a string');
  const hex = value.startsWith('0x') ? value.slice(2) : value;
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new TypeError('Hash must be 32-byte hex');
  return Uint8Array.from(hex.match(/.{2}/g), (part) => Number.parseInt(part, 16));
}
function bytesToHex(value) {
  return '0x' + Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
function concat(...parts) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}
function uint32(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, false);
  return bytes;
}
function parentHash(left, right) {
  return bytesToHex(keccak_256(concat(new Uint8Array([1]), hexToBytes(left), hexToBytes(right))));
}
function peakHeights(count) {
  const heights = [];
  for (let bit = 31; bit >= 0; bit--) {
    const size = 2 ** bit;
    if (count >= size) { heights.push(bit); count -= size; }
  }
  return heights;
}
function bagPeaks(peaks) {
  if (!peaks.length) return bytesToHex(keccak_256(new Uint8Array([2])));
  let bag = peaks[peaks.length - 1].hash;
  for (let i = peaks.length - 2; i >= 0; i--) {
    bag = bytesToHex(keccak_256(concat(
      new Uint8Array([2]), uint32(peaks[i].height),
      hexToBytes(peaks[i].hash), hexToBytes(bag)
    )));
  }
  return bag;
}

/**
 * Append-only MMR. Node positions are zero-based and include leaves and parents.
 * Peaks are kept left-to-right; the root is a domain-separated bag of peaks.
 */
export class MerkleMountainRange {
  constructor(leaves = []) {
    this.leaves = [];
    this.nodes = [];
    this.peaks = [];
    for (const leaf of leaves) this.append(leaf);
  }

  append(leafHash) {
    const hash = bytesToHex(hexToBytes(leafHash));
    const leafIndex = this.leaves.length;
    const leaf = { pos: this.nodes.length, hash, height: 0, leafIndex };
    this.leaves.push(hash);
    this.nodes.push(leaf);

    let peak = { pos: leaf.pos, hash, height: 0, startLeaf: leafIndex };
    while (this.peaks.length && this.peaks[this.peaks.length - 1].height === peak.height) {
      const left = this.peaks.pop();
      const node = {
        pos: this.nodes.length,
        hash: parentHash(left.hash, peak.hash),
        height: peak.height + 1,
        leftPos: left.pos,
        rightPos: peak.pos
      };
      this.nodes.push(node);
      peak = { pos: node.pos, hash: node.hash, height: node.height, startLeaf: left.startLeaf };
    }
    this.peaks.push(peak);
    return { leafIndex, nodePos: leaf.pos, root: this.getRoot() };
  }

  getRoot() { return bagPeaks(this.peaks); }
  getNodeCount() { return this.nodes.length; }
  getPeaks() { return this.peaks.map((peak) => ({ ...peak })); }

  getProof(leafIndex) {
    if (!Number.isSafeInteger(leafIndex) || leafIndex < 0 || leafIndex >= this.leaves.length) {
      throw new RangeError('INDEX_OUT_OF_BOUNDS: ' + leafIndex);
    }

    let mountainStart = 0;
    let peakIndex = -1;
    let height = -1;
    for (let i = 0; i < this.peaks.length; i++) {
      const size = 2 ** this.peaks[i].height;
      if (leafIndex < mountainStart + size) {
        peakIndex = i;
        height = this.peaks[i].height;
        break;
      }
      mountainStart += size;
    }
    if (peakIndex < 0) throw new Error('MMR_INVARIANT_VIOLATION');

    let level = this.leaves.slice(mountainStart, mountainStart + (2 ** height));
    let index = leafIndex - mountainStart;
    const siblings = [];
    while (level.length > 1) {
      const siblingIndex = index ^ 1;
      siblings.push({
        position: index % 2 === 0 ? 'right' : 'left',
        hash: level[siblingIndex]
      });
      const next = [];
      for (let i = 0; i < level.length; i += 2) next.push(parentHash(level[i], level[i + 1]));
      level = next;
      index = Math.floor(index / 2);
    }

    return {
      format: 'trinity-mmr-v1',
      leafIndex,
      leafCount: this.leaves.length,
      mountainStart,
      mountainHeight: height,
      peakIndex,
      siblings,
      peaks: this.peaks.map(({ hash, height: peakHeight }) => ({ hash, height: peakHeight }))
    };
  }
}

export function verifyMmrProof(leafHash, proof, expectedRoot) {
  try {
    if (!proof || proof.format !== 'trinity-mmr-v1') return false;
    if (!Array.isArray(proof.peaks) || !Array.isArray(proof.siblings)) return false;
    if (!Number.isSafeInteger(proof.leafCount) || proof.leafCount < 1) return false;
    if (!Number.isSafeInteger(proof.leafIndex) || proof.leafIndex < 0 || proof.leafIndex >= proof.leafCount) return false;

    const heights = peakHeights(proof.leafCount);
    if (proof.peaks.length !== heights.length) return false;
    if (proof.peaks.some((peak, i) => peak.height !== heights[i])) return false;

    let start = 0;
    let targetPeak = -1;
    for (let i = 0; i < heights.length; i++) {
      const end = start + (2 ** heights[i]);
      if (proof.leafIndex >= start && proof.leafIndex < end) { targetPeak = i; break; }
      start = end;
    }
    if (targetPeak !== proof.peakIndex || start !== proof.mountainStart) return false;
    if (proof.siblings.length !== heights[targetPeak]) return false;

    let current = bytesToHex(hexToBytes(leafHash));
    for (const sibling of proof.siblings) {
      const siblingHash = bytesToHex(hexToBytes(sibling.hash));
      if (sibling.position === 'left') current = parentHash(siblingHash, current);
      else if (sibling.position === 'right') current = parentHash(current, siblingHash);
      else return false;
    }

    const peaks = proof.peaks.map((peak, index) => ({
      height: peak.height,
      hash: index === targetPeak ? current : bytesToHex(hexToBytes(peak.hash))
    }));
    return bagPeaks(peaks).toLowerCase() === String(expectedRoot).toLowerCase();
  } catch {
    return false;
  }
}

export function hashMmrLeaf(value) {
  return bytesToHex(keccak_256(concat(new Uint8Array([0]), encoder.encode(String(value)))));
}


