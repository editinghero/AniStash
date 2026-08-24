const PIN_STORAGE_KEY = "anistash.local-pin.v1";
const PIN_ITERATIONS = 100_000;
const PIN_PATTERN = /^\d{4}$/;

type StoredPin = {
  version: 1;
  userId: string;
  salt: string;
  hash: string;
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function readStoredPin(): StoredPin | null {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(PIN_STORAGE_KEY) ?? "null",
    );
    if (
      !parsed ||
      typeof parsed !== "object" ||
      (parsed as StoredPin).version !== 1 ||
      typeof (parsed as StoredPin).userId !== "string" ||
      typeof (parsed as StoredPin).salt !== "string" ||
      typeof (parsed as StoredPin).hash !== "string"
    ) {
      return null;
    }
    return parsed as StoredPin;
  } catch {
    return null;
  }
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

// Fallback SHA-256 for non-secure HTTP contexts where crypto.subtle is undefined (e.g. mobile LAN IP testing)
function sha256Fallback(ascii: string): Uint8Array {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = "length";
  let i, j;
  let result = "";

  const words: number[] = [];
  const asciiBitLength = ascii[lengthProperty] * 8;

  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let primeCounter = k[lengthProperty];
  const isComposite: Record<number, number> = {};

  ascii += "\x80";
  while ((ascii[lengthProperty] % 64) - 56) ascii += "\x00";
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return new Uint8Array();
    words[i >> 2] |= j << ((3 - (i % 4)) * 8);
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;

  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15],
        w2 = w[i - 2];
      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      w[i] =
        i < 16
          ? w[i]
          : (w[i - 16] + s0 + w[i - 7] + s1) | 0;

      const s1h =
        rightRotate(hash[4], 6) ^
        rightRotate(hash[4], 11) ^
        rightRotate(hash[4], 25);
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const temp1 = (hash[7] + s1h + ch + k[i] + w[i]) | 0;
      const s0h =
        rightRotate(hash[0], 2) ^
        rightRotate(hash[0], 13) ^
        rightRotate(hash[0], 22);
      const maj =
        (hash[0] & hash[1]) ^
        (hash[0] & hash[2]) ^
        (hash[1] & hash[2]);
      const temp2 = (s0h + maj) | 0;

      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  const out = new Uint8Array(32);
  for (i = 0; i < 8; i++) {
    out[i * 4] = (hash[i] >> 24) & 255;
    out[i * 4 + 1] = (hash[i] >> 16) & 255;
    out[i * 4 + 2] = (hash[i] >> 8) & 255;
    out[i * 4 + 3] = hash[i] & 255;
  }
  return out;
}

async function hashPin(pin: string, salt: string): Promise<string> {
  // If Web Cryptography API is supported (HTTPS or localhost)
  if (typeof crypto !== "undefined" && crypto.subtle && typeof crypto.subtle.importKey === "function") {
    try {
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(pin),
        "PBKDF2",
        false,
        ["deriveBits"],
      );
      const bits = await crypto.subtle.deriveBits(
        {
          name: "PBKDF2",
          hash: "SHA-256",
          salt: toArrayBuffer(base64ToBytes(salt)),
          iterations: PIN_ITERATIONS,
        },
        key,
        256,
      );
      return bytesToBase64(new Uint8Array(bits));
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback for non-HTTPS local IP connections (e.g. mobile testing on LAN IP)
  let current = pin + ":" + salt;
  for (let i = 0; i < 1000; i++) {
    const hashedBytes = sha256Fallback(current);
    current = bytesToBase64(hashedBytes);
  }
  return current;
}

function requireValidPin(pin: string) {
  if (!PIN_PATTERN.test(pin)) {
    throw new Error("Your PIN must contain exactly 4 digits");
  }
}

export function hasLocalPinForUser(userId: string): boolean {
  return readStoredPin()?.userId === userId;
}

export async function setLocalPin(userId: string, pin: string): Promise<void> {
  requireValidPin(pin);
  let saltBytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    saltBytes = crypto.getRandomValues(saltBytes);
  } else {
    for (let i = 0; i < 16; i++) saltBytes[i] = Math.floor(Math.random() * 256);
  }
  const salt = bytesToBase64(saltBytes);
  const hash = await hashPin(pin, salt);
  const record: StoredPin = { version: 1, userId, salt, hash };
  localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(record));
}

export async function verifyLocalPin(
  userId: string,
  pin: string,
  ): Promise<boolean> {
  if (!PIN_PATTERN.test(pin)) return false;
  const stored = readStoredPin();
  if (!stored || stored.userId !== userId) return false;
  return (await hashPin(pin, stored.salt)) === stored.hash;
}

export function clearLocalPin(userId: string): void {
  if (readStoredPin()?.userId === userId) {
    localStorage.removeItem(PIN_STORAGE_KEY);
  }
}
