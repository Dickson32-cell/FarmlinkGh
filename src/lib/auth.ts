import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "farmlink-dev-secret-2026");

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createToken(payload: { userId: string; role: string }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as { userId: string; role: string };
  } catch {
    return null;
  }
}

// ---------- Admin session tokens ----------
// Admin sessions are SHORT-LIVED (12h, not 7d) and carry an explicit
// adminVerified claim that is only set after the email-code check.
export const ADMIN_SESSION_HOURS = 12;

export async function createAdminToken(userId: string) {
  return new SignJWT({ userId, role: "admin", adminVerified: true })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${ADMIN_SESSION_HOURS}h`)
    .sign(secret);
}

export async function verifyAdminToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.role !== "admin" || payload.adminVerified !== true) return null;
    return payload as { userId: string; role: string; adminVerified: true };
  } catch {
    return null;
  }
}

// ---------- Admin action tokens (money release step-up) ----------
// Minted only after a fresh admin_action email code. 10-minute TTL.
export async function createAdminActionToken(userId: string) {
  return new SignJWT({ userId, role: "admin", purpose: "admin_action", adminVerified: true })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("10m")
    .sign(secret);
}

export async function verifyAdminActionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (
      payload.purpose !== "admin_action" ||
      payload.role !== "admin" ||
      payload.adminVerified !== true
    ) {
      return null;
    }
    return payload as { userId: string; role: string; purpose: "admin_action" };
  } catch {
    return null;
  }
}