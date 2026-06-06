import { NextRequest } from 'next/server';
import twilio from 'twilio';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const payload = await getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const callSid = searchParams.get('callSid');
  if (!callSid) return apiError('callSid is required');

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  const call = await client.calls(callSid).fetch();

  // in-progress statuses: queued, ringing, in-progress
  const active = ['queued', 'ringing', 'in-progress'].includes(call.status);
  return apiOk({ active, status: call.status });
}
