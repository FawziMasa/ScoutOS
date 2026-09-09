import nodemailer from "nodemailer";

function configuredMailer() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  // Check if all necessary credentials for SMTP exist
  const hasRequiredConfig = host && user && pass && from && Number.isInteger(port) && port > 0;

  if (!hasRequiredConfig) {
    throw new Error("SMTP is not configured.");
  }

  return {
    from,
    transporter: nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    }),
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function createPasswordResetEmail(resetUrl) {
  const safeUrl = escapeHtml(resetUrl);
  const text = [
    "SCOUT OS",
    "",
    "Reset your password",
    "",
    "Use this link to choose a new ScoutOS password:",
    resetUrl,
    "",
    "This link expires in 30 minutes and can be used once.",
    "If you did not request a password reset, you can safely ignore this email.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:32px 16px;background:#f4f7f4;color:#17231c;font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #dbe5dd;border-radius:12px;overflow:hidden;">
          <tr><td style="padding:28px 36px;background:#143c2d;color:#ffffff;"><div style="font-size:13px;font-weight:700;letter-spacing:1.5px;">SCOUT OS</div></td></tr>
          <tr><td style="padding:36px;">
            <h1 style="margin:0 0 14px;font-size:25px;line-height:1.25;color:#17231c;">Reset your password</h1>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#526158;">We received a request to reset your ScoutOS password. Choose a new password using the secure link below.</p>
            <p style="margin:0 0 26px;"><a href="${safeUrl}" style="display:inline-block;padding:13px 20px;border-radius:6px;background:#216b4a;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Reset Password</a></p>
            <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#526158;">This link expires in 30 minutes and can be used once.</p>
            <p style="margin:0;font-size:13px;line-height:1.6;color:#526158;">If you did not request a password reset, you can safely ignore this email.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return { text, html };
}

export async function sendPasswordResetEmail({ to, resetUrl }) {
  const { from, transporter } = configuredMailer();
  const message = createPasswordResetEmail(resetUrl);

  await transporter.sendMail({
    from,
    to,
    subject: "Reset your SCOUT OS password",
    text: message.text,
    html: message.html,
  });
}
