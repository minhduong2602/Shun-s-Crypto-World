import crypto from 'crypto';

// Base32 characters for RFC 4648
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateBase32Secret(length = 20): string {
  const randomBytes = crypto.randomBytes(length);
  let secret = '';
  for (let i = 0; i < randomBytes.length; i++) {
    secret += BASE32_ALPHABET[randomBytes[i] % BASE32_ALPHABET.length];
  }
  return secret;
}

function base32ToBuffer(base32: string): Buffer {
  const cleaned = base32.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = '';
  for (let i = 0; i < cleaned.length; i++) {
    const val = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }

  return Buffer.from(bytes);
}

export function generateTotpCode(secret: string, timeStepWindow = 0): string {
  const timeStep = 30; // 30 seconds
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / timeStep) + timeStepWindow;

  const counterBuffer = Buffer.alloc(8);
  // Write 64-bit integer big-endian
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const secretBuffer = base32ToBuffer(secret);
  const hmac = crypto.createHmac('sha1', secretBuffer);
  hmac.update(counterBuffer);
  const digest = hmac.digest();

  // Dynamic truncation
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const otp = (binary % 1000000).toString().padStart(6, '0');
  return otp;
}

export function verifyTotpCode(secret: string, token: string): boolean {
  if (!secret || !token || token.length !== 6) return false;
  // Allow window of -1, 0, +1 (clock drift tolerance of +/- 30s)
  for (const window of [-1, 0, 1]) {
    const expected = generateTotpCode(secret, window);
    if (expected === token.trim()) {
      return true;
    }
  }
  return false;
}

export function generateTotpUri(accountName: string, issuer: string, secret: string): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(accountName);
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}
