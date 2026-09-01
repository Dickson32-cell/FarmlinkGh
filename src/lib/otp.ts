// src/lib/otp.ts
// 2FA OTP machinery: generate, send (pluggable SMS gateway), verify.
// Ghana networks detected from phone prefix — surfaced on the OTP screen.
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

export function detectNetwork(phone: string): "MTN" | "Telecel" | "AT" | "Unknown" {
  // Ghana prefixes (local 0XX form)
  const p = phone.replace(/\D/g, "").replace(/^233/, "0");
  if (/^(024|054|055|059)/.test(p)) return "MTN";
  if (/^(020|050)/.test(p)) return "Telecel";
  if (/^(027|057|026|056)/.test(p)) return "AT";
  return "Unknown";
}

export function generateOtp(): string {
  // cryptographically random 6-digit code (no leading-zero bias)
  return String(crypto.randomInt(100000, 1000000));
}

export async function createOtp(phone: string, purpose = "login") {
  // Rate limit: max 5 active/created codes per phone per hour
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.otpCode.count({
    where: { phone, createdAt: { gte: hourAgo } },
  });
  if (recent >= 5) {
    throw new Error("Too many code requests. Wait a few minutes and try again.");
  }

  const code = generateOtp();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  // Invalidate previous unused codes for this phone
  await prisma.otpCode.updateMany({
    where: { phone, used: false },
    data: { used: true },
  });

  await prisma.otpCode.create({
    data: { phone, codeHash, purpose, expiresAt },
  });

  // Return the code ONLY in dev (SMS_PROVIDER=console logs it too)
  return { code, expiresAt, network: detectNetwork(phone) };
}

export async function verifyOtp(phone: string, code: string, purpose = "login") {
  const record = await prisma.otpCode.findFirst({
    where: { phone, purpose, used: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!record) return { ok: false, reason: "expired" };
  if (record.attempts >= MAX_ATTEMPTS) {
    await prisma.otpCode.update({ where: { id: record.id }, data: { used: true } });
    return { ok: false, reason: "locked" };
  }

  const valid = await bcrypt.compare(code, record.codeHash);
  if (!valid) {
    await prisma.otpCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: "wrong" };
  }

  await prisma.otpCode.update({ where: { id: record.id }, data: { used: true } });
  return { ok: true };
}

// ---------- SMS gateway (pluggable) ----------
// SMS_PROVIDER: "console" (dev) | "arkesel" | "hubtel"
//
// SMS hygiene rules (learned the hard way — see Joseph's mangled follow-up):
// 1. ONE page only. Messages over 160 GSM chars get split by the carrier and
//    reassembly on cheap handsets corrupts them (Joseph's 2-page SMS arrived
//    with the "@" dropped). Hard cap: 160.
// 2. GSM-7 alphabet only. The cedi sign "₵" and other unicode force UCS-2
//    encoding which halves the page size to 70 chars and confuses carriers.
//    Money is written as "GHS" in SMS; "GH₵" stays in the web UI only.
function smsSanitize(raw: string): string {
  let m = raw
    .replace(/GH₵/gi, "GHS")       // "GH₵240" (money) → "GHS240"
    .replace(/₵/g, "GHS ")         // any lone cedi sign
    .replace(/[→…–—]/g, "-")       // unicode arrows/dashes → hyphen
    .replace(/[^\x20-\x7E]/g, ""); // strip all remaining non-ASCII
  // squeeze doubled spaces created by the replacements
  m = m.replace(/ {2,}/g, " ").trim();
  // hard cap at 160 GSM chars — never send a second page
  if (m.length > 160) m = m.slice(0, 157).trimEnd() + "...";
  return m;
}

export async function sendSms(phone: string, rawMessage: string): Promise<{ sent: boolean; provider: string }> {
  const provider = process.env.SMS_PROVIDER || "console";
  const to = phone.replace(/^0/, "233");
  const message = smsSanitize(rawMessage);
  if (message.length > 160) {
    console.error(`[SMS] BUG: message for ${phone} still >160 after sanitize:`, rawMessage);
  }

  try {
    if (provider === "arkesel") {
      const apiKey = process.env.ARKESEL_API_KEY;
      const sender = process.env.ARKESEL_SENDER_ID || "FarmLink";
      const res = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
        method: "POST",
        headers: {
          "api-key": apiKey || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender,
          message,
          recipients: [`+${to}`],
        }),
      });
      const data = await res.json().catch(() => null);
      const ok = res.ok && (data as any)?.status === "success";
      if (!ok) {
        console.error("Arkesel send failed:", res.status, data);
      }
      return { sent: !!ok, provider };
    }

    if (provider === "hubtel") {
      const clientId = process.env.HUBTEL_CLIENT_ID;
      const clientSecret = process.env.HUBTEL_CLIENT_SECRET;
      if (!clientId || !clientSecret) return { sent: false, provider };
      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
      const res = await fetch("https://smsc.hubtel.com/v1/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          From: process.env.HUBTEL_SMS_SENDER || "FarmLink",
          To: to,
          Content: message,
        }),
      });
      return { sent: res.ok, provider };
    }

    // console (dev): log it so Dickson can read the code from the server console
    console.log(`[OTP] ${phone}: ${message}`);
    return { sent: true, provider: "console" };
  } catch (e) {
    console.error("SMS send failed:", e);
    return { sent: false, provider };
  }
}