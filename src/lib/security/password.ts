import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const passwordHash = scryptSync(password, salt, 32).toString("hex");
  return { passwordHash, passwordSalt: salt };
}

export function verifyPasswordHash(password: string, passwordHash: string, passwordSalt: string) {
  const actual = Buffer.from(scryptSync(password, passwordSalt, 32).toString("hex"), "hex");
  const expected = Buffer.from(passwordHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
