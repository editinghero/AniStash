function toBase64(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr));
}

function fromBase64(str: string): Uint8Array {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

async function getCryptoKey(secretKey: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const rawKey = encoder.encode(secretKey);
  const hashed = await crypto.subtle.digest("SHA-256", rawKey);
  return await crypto.subtle.importKey(
    "raw",
    hashed,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

async function getPbkdf2Key(password: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey", "deriveBits"]
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const baseKey = await getPbkdf2Key(password);
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    baseKey,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    true,
    ["sign"]
  );
  const exported = await crypto.subtle.exportKey("raw", derivedKey);
  const keyBytes = new Uint8Array(exported);
  return `${toBase64(salt)}:${toBase64(keyBytes)}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const parts = hash.split(":");
  if (parts.length !== 2) return false;
  const [saltBase64, keyBase64] = parts;
  const salt = fromBase64(saltBase64);
  const storedKey = fromBase64(keyBase64);

  const baseKey = await getPbkdf2Key(password);
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    baseKey,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    true,
    ["sign"]
  );
  const exported = await crypto.subtle.exportKey("raw", derivedKey);
  const keyBytes = new Uint8Array(exported);

  if (keyBytes.length !== storedKey.length) return false;
  let matches = true;
  for (let i = 0; i < keyBytes.length; i++) {
    if (keyBytes[i] !== storedKey[i]) matches = false;
  }
  return matches;
}

export async function encryptApiKey(apiKey: string, secretKey: string): Promise<string> {
  if (!secretKey) throw new Error("Encryption key not configured");
  const key = await getCryptoKey(secretKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(apiKey)
  );
  return `${toBase64(iv)}:${toBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptApiKey(encrypted: string, secretKey: string): Promise<string> {
  if (!secretKey) throw new Error("Encryption key not configured");
  const parts = encrypted.split(":");
  if (parts.length !== 2) throw new Error("Invalid encrypted format");
  const [ivBase64, ciphertextBase64] = parts;
  const iv = fromBase64(ivBase64);
  const ciphertext = fromBase64(ciphertextBase64);

  const candidateKeys = [
    secretKey,
    "fallback-encryption-key-for-local-dev-123",
    "my-secdsfsdfsdfsgfhdgfure-32-bdcvfyte-local-encryption-key-123456",
  ];

  let lastError: any = null;
  for (const keyStr of candidateKeys) {
    if (!keyStr) continue;
    try {
      const cryptoKey = await getCryptoKey(keyStr);
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        cryptoKey,
        ciphertext
      );
      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Decryption failed");
}
