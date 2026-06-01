import crypto from 'node:crypto';

/**
 * Cifrado AES-256-GCM para los refresh tokens de Google.
 *
 * Formato del string guardado en DB:
 *   v1:<iv-hex>:<tag-hex>:<ciphertext-hex>
 *
 * La clave maestra vive en la env var GOOGLE_TOKEN_ENCRYPTION_KEY
 * (32 bytes en hex, o sea 64 chars). Generala con:
 *   openssl rand -hex 32
 */

const ALGO = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const VERSION_TAG = 'v1';

function loadKey(): Buffer {
  const raw = (process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || '').trim();
  if (!raw) {
    throw new Error(
      'GOOGLE_TOKEN_ENCRYPTION_KEY no está configurada (hex 64 chars). Generala con `openssl rand -hex 32`.'
    );
  }
  if (raw.length !== KEY_BYTES * 2) {
    throw new Error(
      `GOOGLE_TOKEN_ENCRYPTION_KEY debe ser hex de ${KEY_BYTES * 2} caracteres (${KEY_BYTES} bytes).`
    );
  }
  try {
    return Buffer.from(raw, 'hex');
  } catch {
    throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY no es hex válido.');
  }
}

export function isGoogleTokenCryptoConfigured(): boolean {
  const raw = (process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || '').trim();
  return raw.length === KEY_BYTES * 2;
}

export function encryptGoogleToken(plaintext: string): string {
  if (!plaintext) throw new Error('encryptGoogleToken: plaintext vacío.');
  const key = loadKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION_TAG, iv.toString('hex'), tag.toString('hex'), ciphertext.toString('hex')].join(':');
}

export function decryptGoogleToken(payload: string): string {
  if (!payload) throw new Error('decryptGoogleToken: payload vacío.');
  const parts = payload.split(':');
  if (parts.length !== 4) {
    throw new Error('decryptGoogleToken: formato inválido (esperado v1:iv:tag:ciphertext).');
  }
  const [version, ivHex, tagHex, ctHex] = parts;
  if (version !== VERSION_TAG) {
    throw new Error(`decryptGoogleToken: versión no soportada (${version}).`);
  }
  const key = loadKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(ctHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}
