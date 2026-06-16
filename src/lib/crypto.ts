import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const ENCRYPTED_PREFIX = "enc:";

function getKey(): Buffer | null {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) return null;
  const buf = Buffer.from(key, "hex");
  if (buf.length !== 32) {
    console.warn("[crypto] ENCRYPTION_KEY must be 64 hex chars (32 bytes). Encryption disabled.");
    return null;
  }
  return buf;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext;

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const combined = Buffer.concat([iv, authTag, encrypted]);
  return ENCRYPTED_PREFIX + combined.toString("base64");
}

export function decrypt(value: string): string {
  if (!value.startsWith(ENCRYPTED_PREFIX)) return value;

  const key = getKey();
  if (!key) return value;

  try {
    const combined = Buffer.from(value.slice(ENCRYPTED_PREFIX.length), "base64");
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return value;
  }
}

export function isEncryptionEnabled(): boolean {
  return getKey() !== null;
}
