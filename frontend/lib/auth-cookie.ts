export type Role = "Teacher" | "QA" | "Admin";

export const AUTH_COOKIE_NAME = "user_role";
export const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24;

const SESSION_VERSION = "v2";
const VALID_ROLES = new Set<Role>(["Teacher", "QA", "Admin"]);

export interface AuthPayload {
  userId: string;
  email: string;
  fullName: string;
  role: Role;
  iat: number;
  exp: number;
}

function getAuthCookieSecret(): string {
  const secret = (process.env.AUTH_COOKIE_SECRET || "").trim();
  if (!secret) {
    throw new Error("AUTH_COOKIE_SECRET is required for session cookies.");
  }
  return secret;
}

function textEncoder(): TextEncoder {
  return new TextEncoder();
}

function textDecoder(): TextDecoder {
  return new TextDecoder();
}

function base64UrlEncode(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/");
  const padding = "=".repeat((4 - (padded.length % 4)) % 4);
  const binary = atob(padded + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    textEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export function normalizeRole(value: string | undefined | null): Role | null {
  if (!value) {
    return null;
  }
  return VALID_ROLES.has(value as Role) ? (value as Role) : null;
}

export async function createAuthCookieValue(
  user: { userId: string; email: string; fullName: string; role: Role },
  nowMs = Date.now(),
): Promise<string> {
  const payload: AuthPayload = {
    userId: user.userId,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    iat: Math.floor(nowMs / 1000),
    exp: Math.floor(nowMs / 1000) + AUTH_COOKIE_MAX_AGE_SECONDS,
  };
  const payloadBytes = textEncoder().encode(JSON.stringify(payload));
  const key = await importHmacKey(getAuthCookieSecret());
  const signature = await crypto.subtle.sign("HMAC", key, payloadBytes);
  return [SESSION_VERSION, base64UrlEncode(payloadBytes), base64UrlEncode(new Uint8Array(signature))].join(".");
}

export async function verifyAuthCookieValue(rawValue: string | undefined | null): Promise<AuthPayload | null> {
  const secret = (process.env.AUTH_COOKIE_SECRET || "").trim();
  if (!secret) {
    return null;
  }

  if (!rawValue) {
    return null;
  }

  const parts = rawValue.split(".");
  if (parts.length !== 3 || (parts[0] !== SESSION_VERSION && parts[0] !== "v1")) {
    return null;
  }

  const payloadBytes = base64UrlDecode(parts[1]);
  const signatureBytes = base64UrlDecode(parts[2]);
  const key = await importHmacKey(secret);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes as unknown as BufferSource,
    payloadBytes as unknown as BufferSource,
  );
  if (!valid) {
    return null;
  }

  try {
    const payload = JSON.parse(textDecoder().decode(payloadBytes)) as Partial<AuthPayload>;
    const role = normalizeRole(payload.role);
    if (!role || typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return {
      userId: payload.userId ?? "",
      email: payload.email ?? "",
      fullName: payload.fullName ?? "",
      role,
      iat: payload.iat ?? 0,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}
