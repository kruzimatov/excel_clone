import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;

function encodeBase64(buffer: Buffer) {
  return buffer.toString('base64');
}

function decodeBase64(value: string) {
  return Buffer.from(value, 'base64');
}

export function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derivedKey = scryptSync(password, salt, KEY_LENGTH);
  return `scrypt$${encodeBase64(salt)}$${encodeBase64(derivedKey)}`;
}

export function verifyPassword(password: string, encoded: string) {
  const [scheme, saltB64, keyB64] = encoded.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !keyB64) {
    return false;
  }

  const salt = decodeBase64(saltB64);
  const expected = decodeBase64(keyB64);
  if (expected.length !== KEY_LENGTH) {
    return false;
  }

  const derivedKey = scryptSync(password, salt, KEY_LENGTH);
  return timingSafeEqual(derivedKey, expected);
}

