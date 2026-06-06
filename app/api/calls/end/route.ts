import { NextRequest } from 'next/server';
import twilio from 'twilio';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';

export async function POST(req: NextRequest) {
  const payload = await getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);

  const { callSid } = await req.json();
  if (!callSid) return apiError('callSid is required');

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  await client.calls(callSid).update({ status: 'completed' });

  return apiOk({ ended: true });
}
