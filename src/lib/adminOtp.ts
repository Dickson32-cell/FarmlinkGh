// src/lib/adminOtp.ts
// Admin email-code machinery: create / verify / rate-limit.
// Codes are 8 digits, bcrypt-hashed at rest, single-use, 10-minute TTL.
// The email they go to is fixed by env: ADMIN_EMAIL (dicksonapam@gmail.com).
// Rate limits: 5 codes/hour per email, 5 wrong attempts per code → code dead.
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/mailer";

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "dicksonapam@gmail.com";

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

export function generateAdminCode(): string {
  // cryptographically random 8-digit code
  return String(crypto.randomInt(10000000, 100000000));
}

export async function createAdminOtp(purpose: "admin_login" | "admin_action", ip = "") {
  // Rate limit: max 5 codes per email per hour
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.adminOtp.count({
    where: { email: ADMIN_EMAIL, createdAt: { gte: hourAgo } },
  });
  if (recent >= 5) {
    throw new Error("Too many code requests. Wait a few minutes and try again.");
  }

  const code = generateAdminCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  // Invalidate previous unused codes for this purpose
  await prisma.adminOtp.updateMany({
    where: { email: ADMIN_EMAIL, purpose, used: false },
    data: { used: true },
  });

  await prisma.adminOtp.create({
    data: { email: ADMIN_EMAIL, codeHash, purpose, expiresAt, ip },
  });

  return { code, expiresAt };
}

export async function verifyAdminOtp(
  code: string,
  purpose: "admin_login" | "admin_action"
): Promise<{ ok: boolean; reason?: string }> {
  const record = await prisma.adminOtp.findFirst({
    where: { email: ADMIN_EMAIL, purpose, used: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!record) return { ok: false, reason: "expired" };
  if (record.attempts >= MAX_ATTEMPTS) {
    await prisma.adminOtp.update({ where: { id: record.id }, data: { used: true } });
    return { ok: false, reason: "locked" };
  }

  const valid = await bcrypt.compare(code, record.codeHash);
  if (!valid) {
    await prisma.adminOtp.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: "wrong" };
  }

  await prisma.adminOtp.update({ where: { id: record.id }, data: { used: true } });
  return { ok: true };
}

// Send the admin code by email. In console mode the code lands in the server
// logs (Vercel → Deployments → Functions → Logs). With SMTP/Resend credentials
// it lands in the real inbox at ADMIN_EMAIL.
export async function sendAdminCodeEmail(code: string, what: string): Promise<{ sent: boolean; provider: string }> {
  const subject = `FarmLink Admin — ${what} code: ${code.slice(0, 2)}••••••`;
  const text =
    `FarmLink Ghana Admin\n\n` +
    `${what} verification code:\n\n` +
    `    ${code}\n\n` +
    `This code expires in 10 minutes.\n` +
    `If you did not attempt this action, change your admin password immediately.\n\n` +
    `— FarmLink Ghana`;
  return sendEmail(ADMIN_EMAIL, subject, text);
}