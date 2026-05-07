/**
 * Email service — uses Resend (https://resend.com) via plain fetch.
 * No extra package needed; just set RESEND_API_KEY in your env.
 *
 * Env vars:
 *   RESEND_API_KEY   — Resend API key (required for actual delivery)
 *   EMAIL_FROM       — sender address, e.g. "FinanceAI <noreply@yourdomain.com>"
 *                      Defaults to "noreply@financeai.app" when unset.
 *
 * Dev fallback: if RESEND_API_KEY is absent the email is logged to console
 * instead of sent — useful for local development without an API key.
 */

const RESEND_API_URL = "https://api.resend.com/emails";
const FROM_ADDRESS = process.env.EMAIL_FROM ?? "FinanceAI <noreply@financeai.app>";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // Dev / CI fallback — never silently discard
    console.warn("[email] RESEND_API_KEY not set. Email not sent.");
    console.info(`[email] To: ${to}\n[email] Subject: ${subject}\n[email] Body:\n${text}`);
    return;
  }

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html, text }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}

/**
 * Send a password-reset email.
 * The reset link expires in 1 hour (enforced server-side on the token).
 */
export async function sendPasswordResetEmail(
  email: string,
  token: string,
  baseUrl: string
): Promise<void> {
  const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`;

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
      <h2 style="color:#3b82f6">Reset your FinanceAI password</h2>
      <p>We received a request to reset the password for your account (<strong>${email}</strong>).</p>
      <p>Click the button below to choose a new password. This link expires in <strong>1 hour</strong>.</p>
      <a href="${resetUrl}"
         style="display:inline-block;margin:16px 0;padding:12px 24px;background:#3b82f6;
                color:#fff;text-decoration:none;border-radius:6px;font-weight:600">
        Reset Password
      </a>
      <p>If the button doesn't work, copy and paste this URL into your browser:</p>
      <p style="word-break:break-all;color:#6b7280;font-size:13px">${resetUrl}</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
      <p style="color:#9ca3af;font-size:12px">
        If you didn't request a password reset, you can safely ignore this email.
        Your password will not change.
      </p>
    </div>
  `.trim();

  const text = [
    "Reset your FinanceAI password",
    "",
    `We received a request to reset the password for ${email}.`,
    "Click the link below to choose a new password (expires in 1 hour):",
    "",
    resetUrl,
    "",
    "If you didn't request this, you can safely ignore this email.",
  ].join("\n");

  await sendEmail({
    to: email,
    subject: "Reset your FinanceAI password",
    html,
    text,
  });
}
