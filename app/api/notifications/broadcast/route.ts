import { NextRequest } from 'next/server';
import twilio from 'twilio';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';
import { sendEmail, isEmailConfigured, buildCustomerEmailHtml } from '@/lib/email';

function getTwilioClient() {
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);
  if (!['ADMIN','MANAGER'].includes(payload.role)) return apiError('Forbidden', 403);

  const { customerIds, channels, subject, message } = await req.json();

  if (!message?.trim()) return apiError('Message is required');
  if (!channels?.length) return apiError('Select at least one channel');

  const where = customerIds?.length > 0
    ? { id: { in: customerIds as string[] } }
    : {};

  const customers = await prisma.customer.findMany({
    where,
    select: { id: true, name: true, email: true, phone: true },
  });

  let emailSent = 0, emailFailed = 0, smsSent = 0, smsFailed = 0;
  const emailReady = isEmailConfigured();
  const smsReady = !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER &&
    process.env.TWILIO_AUTH_TOKEN !== 'your_auth_token' &&
    !process.env.TWILIO_PHONE_NUMBER.includes('1234567890')
  );

  for (const customer of customers) {
    if (channels.includes('EMAIL')) {
      if (!customer.email) { emailFailed++; continue; }
      if (emailReady) {
        try {
          await sendEmail({
            to: customer.email,
            subject: subject?.trim() || 'Message from Nexora Care',
            html: buildCustomerEmailHtml(customer.name, message),
            text: message,
          });
          emailSent++;
        } catch (err) {
          console.error(`Email failed for ${customer.email}:`, err);
          emailFailed++;
        }
      } else {
        emailFailed++;
      }
    }

    if (channels.includes('SMS')) {
      if (!customer.phone) { smsFailed++; continue; }
      if (smsReady) {
        try {
          await getTwilioClient().messages.create({
            body: message,
            from: process.env.TWILIO_SENDER_ID || process.env.TWILIO_PHONE_NUMBER!,
            to: customer.phone,
          });
          smsSent++;
        } catch (err) {
          console.error(`SMS failed for ${customer.phone}:`, err);
          smsFailed++;
        }
      } else {
        smsFailed++;
      }
    }
  }

  return apiOk({ emailSent, emailFailed, smsSent, smsFailed, total: customers.length });
}
