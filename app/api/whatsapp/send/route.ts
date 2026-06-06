import { NextRequest } from 'next/server';
import twilio from 'twilio';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';

export async function POST(req: NextRequest) {
  const payload = await getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);

  const { phone, message } = await req.json();
  if (!phone?.trim()) return apiError('Phone number is required');
  if (!message?.trim()) return apiError('Message is required');

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_NUMBER;

  if (!accountSid || !authToken || !from) {
    return apiError('WhatsApp (Twilio) is not configured', 503);
  }

  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  const to = `whatsapp:+${digits}`;

  try {
    const client = twilio(accountSid, authToken);
    await client.messages.create({ body: message, from, to });
    return apiOk({ sent: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to send WhatsApp message';
    console.error('WhatsApp send error:', err);
    return apiError(msg, 500);
  }
}
