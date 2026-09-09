import { describe, expect, it } from 'vitest';
import { canonicalize, cidV1Raw, keccakOf, merkleRoot } from './canonical.js';

describe('canonical serialisation', () => {
  it('sorts keys recursively and drops undefined', () => {
    expect(canonicalize({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: undefined } })).toBe('{"a":{"d":[3,{"y":2,"z":1}]},"b":1}');
  });

  it('hashes are order-independent', () => {
    expect(keccakOf({ a: 1, b: 2 })).toBe(keccakOf({ b: 2, a: 1 }));
    expect(keccakOf({ a: 1, b: 2 })).not.toBe(keccakOf({ a: 1, b: 3 }));
  });

  it('rejects non-finite numbers', () => {
    expect(() => canonicalize({ x: NaN })).toThrow();
  });

  it('produces a well-formed CIDv1 raw sha2-256', () => {
    // sha256("hello") = 2cf24dba…9824, wrapped as CIDv1 raw; cross-checked against an independent base32 encoder.
    const cid = cidV1Raw(new TextEncoder().encode('hello'));
    expect(cid).toBe('bafkreibm6jg3ux5qumhcn2b3flc3tyu6dmlb4xa7u5bf44yegnrjhc4yeq');
    expect(cid).toMatch(/^bafkrei[a-z2-7]{52}$/);
  });

  it('merkle root is order-independent and sensitive to membership', () => {
    const a = merkleRoot(['8a2a1072b59ffff', '8a2a1072b5bffff', '8a2a1072b4fffff']);
    const b = merkleRoot(['8a2a1072b4fffff', '8a2a1072b59ffff', '8a2a1072b5bffff']);
    expect(a).toBe(b);
    expect(merkleRoot(['8a2a1072b59ffff'])).not.toBe(a);
  });
});
