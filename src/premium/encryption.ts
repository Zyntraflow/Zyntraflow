import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;

const toKeyBuffer = (key: Uint8Array): Buffer => {
  const keyBuffer = Buffer.from(key);
  if (keyBuffer.length !== KEY_LENGTH_BYTES) {
    throw new Error(`AES-256-GCM requires a 32-byte key; received ${keyBuffer.length} bytes.`);
  }
  return keyBuffer;
};

export const deriveKeyFromSignature = (signature: string, salt: Uint8Array): Uint8Array => {
  if (!signature || signature.trim() === "") {
    throw new Error("User signature is required to derive an encryption key.");
  }

  const hash = createHash("sha256");
  hash.update(signature.trim(), "utf8");
  hash.update(Buffer.from(salt));
  return new Uint8Array(hash.digest());
};

export const encryptJson = (obj: unknown, key: Uint8Array): { ciphertextBase64: string; ivBase64: string } => {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv("aes-256-gcm", toKeyBuffer(key), iv);
  const plaintext = Buffer.from(JSON.stringify(obj), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const packedCiphertext = Buffer.concat([encrypted, authTag]);

  return {
    ciphertextBase64: packedCiphertext.toString("base64"),
    ivBase64: iv.toString("base64"),
  };
};

export const decryptJson = (
  payload: { ciphertextBase64: string; ivBase64: string },
  key: Uint8Array,
): unknown => {
  const iv = Buffer.from(payload.ivBase64, "base64");
  const packedCiphertext = Buffer.from(payload.ciphertextBase64, "base64");
  if (packedCiphertext.length <= AUTH_TAG_LENGTH_BYTES) {
    throw new Error("Ciphertext payload is invalid.");
  }

  const ciphertext = packedCiphertext.subarray(0, packedCiphertext.length - AUTH_TAG_LENGTH_BYTES);
  const authTag = packedCiphertext.subarray(packedCiphertext.length - AUTH_TAG_LENGTH_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", toKeyBuffer(key), iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  return JSON.parse(plaintext);
};
