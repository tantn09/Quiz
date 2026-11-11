import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const scrypt = (password: string, salt: Buffer) => new Promise<Buffer>((resolve, reject) => {
  scryptCallback(password, salt, 64, { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => {
    if (error) reject(error);
    else resolve(key as Buffer);
  });
});

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt);
  return `scrypt$16384$8$1$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(encoded: string, password: string): Promise<boolean> {
  const [algorithm, n, r, p, saltText, keyText] = encoded.split("$");
  if (algorithm !== "scrypt" || n !== "16384" || r !== "8" || p !== "1" || !saltText || !keyText) return false;
  try {
    const expected = Buffer.from(keyText, "base64url");
    const actual = await scrypt(password, Buffer.from(saltText, "base64url"));
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
