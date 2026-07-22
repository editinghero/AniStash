const PIN_STORAGE_KEY = "anistash.local-pin.v1";
const PIN_ITERATIONS = 150_000;
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

async function hashPin(pin: string, salt: string): Promise<string> {
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
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
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
