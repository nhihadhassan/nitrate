import { describe, expect, it } from 'vitest';

import { createPublicShareToken, hashPublicShareToken } from './share-token';

describe('public share tokens', () => {
  it('creates a 32-byte bearer token and stores only a deterministic digest', () => {
    const token = createPublicShareToken();
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(hashPublicShareToken(token)).toHaveLength(32);
    expect(hashPublicShareToken(token).equals(Buffer.from(token, 'base64url'))).toBe(false);
    expect(hashPublicShareToken(token).equals(hashPublicShareToken(token))).toBe(true);
  });

  it('rejects malformed and short tokens', () => {
    expect(() => hashPublicShareToken('short')).toThrow(/invalid/i);
  });
});
