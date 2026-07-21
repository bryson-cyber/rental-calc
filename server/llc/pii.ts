import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * At-rest encryption for founder SSNs (AES-256-GCM). The key comes from
 * PII_ENCRYPTION_KEY (64 hex chars — generate with `openssl rand -hex 32`).
 * Fail-closed: if the key is missing, SSNs cannot be saved at all; nothing
 * ever falls back to plaintext storage.
 */
export class PiiConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PiiConfigurationError";
  }
}

const VERSION = "v1";

function getKey(env: NodeJS.ProcessEnv): Buffer | null {
  const raw = env.PII_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  // Any other non-empty value is hashed to 32 bytes so a passphrase also works.
  return createHash("sha256").update(raw).digest();
}

export function isPiiEncryptionConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return getKey(env) !== null;
}

export function encryptPii(
  plaintext: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const key = getKey(env);
  if (!key) {
    throw new PiiConfigurationError(
      "PII_ENCRYPTION_KEY is not configured; SSNs cannot be stored. Generate one with `openssl rand -hex 32`.",
    );
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/** Returns null for unset values, unknown formats, wrong keys, or tampering. */
export function decryptPii(
  stored: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (!stored) return null;
  const key = getKey(env);
  if (!key) return null;

  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  try {
    const [, ivB64, tagB64, ciphertextB64] = parts;
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextB64, "base64")),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  } catch {
    console.warn("[PII] Stored value could not be decrypted (wrong key or corrupt data)");
    return null;
  }
}

/** Display form for operations surfaces: last four digits only. */
export function maskSsn(ssn: string | null | undefined): string | null {
  if (!ssn) return null;
  const digits = ssn.replace(/\D/g, "");
  if (digits.length < 4) return "•••-••-••••";
  return `•••-••-${digits.slice(-4)}`;
}
