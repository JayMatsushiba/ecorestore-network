/**
 * Canonical serialisation and content hashing.
 *
 * Every hash the system commits — analysis plan, geometry, evidence, result —
 * is keccak256 over canonical JSON (sorted keys, no whitespace), so any third
 * party can re-derive it from the same document.
 */
import { createHash } from 'node:crypto';
import { keccak256, toBytes } from 'viem';
import type { Hex } from './models.js';

export function canonicalize(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = sortDeep(v);
    }
    return out;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error(`Cannot canonicalize non-finite number: ${value}`);
  }
  return value;
}

export function keccakOf(value: unknown): Hex {
  return keccak256(toBytes(canonicalize(value)));
}

export function keccakOfString(s: string): Hex {
  return keccak256(toBytes(s));
}

export function sha256Bytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(createHash('sha256').update(bytes).digest());
}

/**
 * CIDv1, raw codec (0x55), sha2-256 multihash, base32 lower-case ("bafkrei...").
 * Computed locally so the evidence commitment is content-addressed and
 * verifiable; it is NOT pinned to IPFS by this prototype.
 */
export function cidV1Raw(bytes: Uint8Array): string {
  const digest = sha256Bytes(bytes);
  const multihash = new Uint8Array(2 + digest.length);
  multihash[0] = 0x12; // sha2-256
  multihash[1] = digest.length;
  multihash.set(digest, 2);
  const cidBytes = new Uint8Array(2 + multihash.length);
  cidBytes[0] = 0x01; // CIDv1
  cidBytes[1] = 0x55; // raw
  cidBytes.set(multihash, 2);
  return 'b' + base32Lower(cidBytes);
}

function base32Lower(bytes: Uint8Array): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31];
  return out;
}

/** Merkle root over sorted leaves; leaves hashed as keccak256(utf8). */
export function merkleRoot(leaves: string[]): Hex {
  if (leaves.length === 0) return keccakOfString('');
  let level: Hex[] = [...leaves].sort().map((l) => keccakOfString(l));
  while (level.length > 1) {
    const next: Hex[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const a = level[i]!;
      const b = level[i + 1] ?? a;
      next.push(keccak256(concatHex(a, b)));
    }
    level = next;
  }
  return level[0]!;
}

function concatHex(a: Hex, b: Hex): Hex {
  return `0x${a.slice(2)}${b.slice(2)}`;
}
