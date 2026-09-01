// src/lib/mailer.ts
// Admin email-code delivery — pluggable, same pattern as the SMS gateway.
//
// EMAIL_PROVIDER:
//   "smtp"    → real delivery via nodemailer (Gmail App Password etc.)
//   "resend"  → real delivery via Resend API (RESEND_API_KEY)
//   "console" → logs the code to the server console (dev + bootstrap mode).
//               Vercel: check the function logs at
//               vercel.com → Project → Deployments → Functions → Logs.
//
// Auto-selection: if SMTP or RESEND credentials are present they win over
// "console", so adding credentials is enough to go live — no code changes.
export async function sendEmail(
  to: string,
  subject: string,
  text: string
): Promise<{ sent: boolean; provider: string }> {
  const resendKey = process.env.RESEND_API_KEY;
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD;
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);

  try {
    // ---- Resend (simplest real provider) ----
    if (resendKey && resendKey.length > 10) {
      const from = process.env.EMAIL_FROM || "FarmLink <onboarding@resend.dev>";
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from, to: [to], subject, text }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        console.error("Resend send failed:", res.status, data);
        // CRITICAL FALLBACK: never lose an admin code — if the email could not
        // be delivered, log it so it is always recoverable from the function
        // logs (Vercel → Deployments → Functions → Logs).
        console.log(`[ADMIN-EMAIL-FALLBACK] delivery failed; code recoverable below :: to=${to} :: ${subject} :: ${text}`);
        return { sent: false, provider: "resend" };
      }
      return { sent: true, provider: "resend" };
    }

    // ---- SMTP (nodemailer is imported lazily — optional dependency) ----
    if (smtpUser && smtpPass && !/your|xxx|placeholder/i.test(smtpPass)) {
      const nodemailer = await import("nodemailer").catch(() => null);
      if (!nodemailer) {
        console.error("SMTP configured but nodemailer is not installed (npm i nodemailer)");
        // fall through to console logging so the code is not lost
      } else {
        const transport = nodemailer.default.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPass },
        });
        await transport.sendMail({
          from: process.env.EMAIL_FROM || smtpUser,
          to,
          subject,
          text,
        });
        return { sent: true, provider: "smtp" };
      }
    }

    // ---- console (bootstrap / dev) ----
    console.log(`[ADMIN-EMAIL] to=${to} :: ${subject} :: ${text}`);
    return { sent: true, provider: "console" };
  } catch (e) {
    console.error("Email send failed:", e);
    return { sent: false, provider: "error" };
  }
}