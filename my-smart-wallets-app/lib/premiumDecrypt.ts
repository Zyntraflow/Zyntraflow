const AUTH_TAG_LENGTH_BYTES = 16;
const KEY_LENGTH_BYTES = 32;

type PremiumEncryptedPayload = {
  ciphertextBase64: string;
  ivBase64: string;
  saltBase64: string;
};

const assertWebCrypto = (): Crypto => {
  const cryptoRef = globalThis.crypto;
  if (!cryptoRef?.subtle) {
    throw new Error("WebCrypto API is unavailable in this environment.");
  }
  return cryptoRef;
};

const base64ToBytes = (base64: string): Uint8Array => {
  const normalized = base64.trim();
  if (normalized === "") {
    throw new Error("Base64 payload cannot be empty.");
  }

  const decoded = atob(normalized);
  const out = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i += 1) {
    out[i] = decoded.charCodeAt(i);
  }
  return out;
};

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
};

export const deriveKeyFromSignature = async (signature: string, salt: Uint8Array): Promise<Uint8Array> => {
  const trimmed = signature.trim();
  if (trimmed === "") {
    throw new Error("Signature is required.");
  }

  const crypto = assertWebCrypto();
  const encoder = new TextEncoder();
  const input = new Uint8Array(encoder.encode(trimmed).length + salt.length);
  input.set(encoder.encode(trimmed), 0);
  input.set(salt, encoder.encode(trimmed).length);

  const digest = await crypto.subtle.digest("SHA-256", input);
  return new Uint8Array(digest);
};

export const decryptPremiumJson = async (
  payload: PremiumEncryptedPayload,
  signature: string,
): Promise<unknown> => {
  const crypto = assertWebCrypto();
  const packedCiphertext = base64ToBytes(payload.ciphertextBase64);
  const iv = base64ToBytes(payload.ivBase64);
  const salt = base64ToBytes(payload.saltBase64);

  if (packedCiphertext.length <= AUTH_TAG_LENGTH_BYTES) {
    throw new Error("Ciphertext payload is invalid.");
  }

  const keyBytes = await deriveKeyFromSignature(signature, salt);
  if (keyBytes.length !== KEY_LENGTH_BYTES) {
    throw new Error("Invalid derived key length.");
  }

  const cryptoKey = await crypto.subtle.importKey("raw", toArrayBuffer(keyBytes), { name: "AES-GCM" }, false, [
    "decrypt",
  ]);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    cryptoKey,
    toArrayBuffer(packedCiphertext),
  );
  const plaintext = new TextDecoder().decode(new Uint8Array(decrypted));
  return JSON.parse(plaintext);
};

export type { PremiumEncryptedPayload };
