import { createHash, randomBytes } from 'node:crypto';

export function createPublicShareToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashPublicShareToken(token: string): Buffer {
  let bytes: Buffer;
  try {
    bytes = Buffer.from(token, 'base64url');
  } catch {
    throw new Error('Invalid share token.');
  }
  if (bytes.length !== 32) throw new Error('Invalid share token.');
  return createHash('sha256').update(bytes).digest();
}
