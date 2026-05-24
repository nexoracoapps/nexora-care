import nodemailer from 'nodemailer';

export function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export function isEmailConfigured(): boolean {
  const pass = process.env.SMTP_PASS || '';
  return !!(
    process.env.SMTP_USER &&
    pass &&
    pass !== 'your-gmail-app-password-here'
  );
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"Nexora Care" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
    text,
  });
}

export function buildCustomerEmailHtml(name: string, message: string): string {
  const escaped = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.10);">
        <tr>
          <td style="background:linear-gradient(135deg,#C4788C,#7B5EA8);padding:32px 40px;text-align:center;">
            <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:12px;padding:10px 18px;margin-bottom:10px;">
              <span style="color:#fff;font-size:22px;font-weight:900;letter-spacing:-0.5px;">Nexora Care</span>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px 24px;">
            <p style="margin:0 0 18px;color:#374151;font-size:15px;line-height:1.65;">
              Hi <strong>${name}</strong>,
            </p>
            <div style="color:#374151;font-size:15px;line-height:1.75;">
              ${escaped}
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:16px 40px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              © ${new Date().getFullYear()} Nexora Care &nbsp;·&nbsp; ${process.env.SMTP_USER || 'nexoracoapps@gmail.com'}
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
