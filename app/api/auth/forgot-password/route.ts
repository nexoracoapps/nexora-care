import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { sendEmail, isEmailConfigured } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { apiError, apiOk } from '@/lib/utils';

const otpStore = new Map<string, { otp: string; expires: number }>();

async function sendResetEmail(to: string, code: string) {
  await sendEmail({
    to,
    subject: 'Your Nexora Care Password Reset Code',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.10);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#e53e5a,#9b5de5);padding:36px 40px;text-align:center;">
            <div style="font-size:32px;margin-bottom:10px;">🔑</div>
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">Password Reset</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.80);font-size:14px;">Nexora Care</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
              Hi there,<br>
              We received a request to reset the password for your Nexora Care account.
              Use the code below — it expires in <strong>10 minutes</strong>.
            </p>
            <!-- OTP Box -->
            <div style="background:linear-gradient(135deg,rgba(229,62,90,0.08),rgba(155,93,229,0.06));border:2px dashed rgba(229,62,90,0.35);border-radius:14px;padding:28px;text-align:center;margin:28px 0;">
              <div style="font-size:11px;font-weight:700;letter-spacing:2px;color:#9b5de5;text-transform:uppercase;margin-bottom:12px;">Verification Code</div>
              <div style="font-size:44px;font-weight:900;letter-spacing:14px;color:#e53e5a;font-family:monospace;">${code}</div>
            </div>
            <p style="margin:0 0 10px;color:#6b7280;font-size:13px;line-height:1.6;">
              If you didn't request this, you can safely ignore this email — your password won't change.
            </p>
            <p style="margin:0;color:#6b7280;font-size:13px;">
              For security, this code will expire after 10 minutes.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              © ${new Date().getFullYear()} Nexora Care &nbsp;·&nbsp; nexoracoapps@gmail.com
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    text: `Your Nexora Care password reset code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, ignore this email.`,
  });
}

export async function POST(req: NextRequest) {
  const { step, email, otp, newPassword } = await req.json();

  if (step === 'request') {
    if (!email) return apiError('Email is required');
    const user = await prisma.user.findFirst({ where: { email } });
    if (!user) return apiError('No account found with that email');

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(email, { otp: code, expires: Date.now() + 10 * 60 * 1000 });

    const smtpConfigured = isEmailConfigured();

    if (smtpConfigured) {
      try {
        await sendResetEmail(email, code);
        return apiOk({ message: 'Reset code sent to your email' });
      } catch (err) {
        console.error('Email send failed:', err);
        return apiError('Failed to send email. Please try again.');
      }
    }

    // Dev fallback: return OTP in response
    console.log(`[DEV] Password reset OTP for ${email}: ${code}`);
    return apiOk({ message: 'OTP generated (dev mode)', otp: code });
  }

  if (step === 'reset') {
    if (!email || !otp || !newPassword) return apiError('All fields are required');
    const stored = otpStore.get(email);
    if (!stored || stored.otp !== otp) return apiError('Invalid or expired code.');
    if (Date.now() > stored.expires) return apiError('OTP has expired. Please request a new one');
    if (newPassword.length < 6) return apiError('Password must be at least 6 characters');
    const user = await prisma.user.findFirst({ where: { email } });
    if (!user) return apiError('User not found');
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
    otpStore.delete(email);
    return apiOk({ message: 'Password reset successfully' });
  }

  return apiError('Invalid step');
}
