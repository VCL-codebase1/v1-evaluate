import { createHmac, timingSafeEqual } from "crypto";

export type JwtClaims = {
  sub: string;
  role: string;
  name: string;
  typ: "access" | "refresh";
  jti?: string;
  iat: number;
  exp: number;
};

function secret() {
  const value = process.env.JWT_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production.");
  }
  return "v11-estimate-dev-jwt-secret";
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

export function signJwt(claims: Omit<JwtClaims, "iat" | "exp">, ttlSeconds: number) {
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtClaims = { ...claims, iat: now, exp: now + ttlSeconds };
  const data = `${encode(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${encode(JSON.stringify(payload))}`;
  const signature = createHmac("sha256", secret()).update(data).digest("base64url");
  return `${data}.${signature}`;
}

export function verifyJwt(token: string | undefined | null): JwtClaims | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const data = `${header}.${body}`;
  const expected = createHmac("sha256", secret()).update(data).digest("base64url");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;

  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as JwtClaims;
    if (!claims.sub || !claims.role || !claims.exp || claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}
