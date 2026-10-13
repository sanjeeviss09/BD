import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'bdiq-production-secure-default-encryption-salt-2026';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a plaintext string (e.g. an API Key) using AES-256-GCM.
 * Output format: `ivHex:authTagHex:encryptedHex`
 */
export function encryptApiKey(plaintext: string): string {
  if (!plaintext) return '';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a ciphertext bundle produced by encryptApiKey.
 */
export function decryptApiKey(encryptedBundle: string): string {
  if (!encryptedBundle) return '';
  const parts = encryptedBundle.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted API key format');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Masks an API key so that only a hint of it is visible (e.g. `sk-...4a2b`).
 * Never displays the full key in browser responses, logs, or reports.
 */
export function maskApiKey(key: string): string {
  if (!key) return '';
  const trimmed = key.trim();
  if (trimmed.length <= 8) {
    return '••••••••';
  }
  const prefix = trimmed.slice(0, 3);
  const suffix = trimmed.slice(-4);
  return `${prefix}...${suffix}`;
}
