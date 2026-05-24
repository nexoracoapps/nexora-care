import { NextRequest } from 'next/server';
import twilio from 'twilio';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);

  const { customerId, phone, customerName } = await req.json();
  if (!phone) return apiError('Phone number is required');

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  const baseUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:6001';

  if (!accountSid || !authToken || !from) {
    return apiError('Twilio is not configured', 503);
  }

  const client = twilio(accountSid, authToken);

  const call = await client.calls.create({
    from,
    to: phone,
    twiml: `<Response><Say voice="alice">Hello, this is a call from Nexora Care.</Say><Pause length="120"/></Response>`,
    statusCallback: `${baseUrl}/api/calls/status`,
    statusCallbackMethod: 'POST',
    statusCallbackEvent: ['completed'],
  });

  // Save initial call log — duration updated later via webhook
  await prisma.callLog.create({
    data: {
      customerId: customerId || null,
      customerName: customerName || null,
      endedAt: null,
      durationSeconds: null,
      status: 'INITIATED',
      notes: call.sid,
    },
  });

  return apiOk({ callSid: call.sid });
}
