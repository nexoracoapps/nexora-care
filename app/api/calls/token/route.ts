import { NextRequest } from 'next/server';
import twilio from 'twilio';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';

const { AccessToken } = twilio.jwt;
const { VoiceGrant } = AccessToken;

export async function GET(req: NextRequest) {
  const payload = await getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKey = process.env.TWILIO_API_KEY;
  const apiSecret = process.env.TWILIO_API_SECRET;
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

  if (!accountSid || !apiKey || !apiSecret || !twimlAppSid ||
      apiKey === 'SKxxxxx' || twimlAppSid === 'APxxxxx') {
    return apiError('Twilio Voice is not configured', 503);
  }

  const token = new AccessToken(accountSid, apiKey, apiSecret, {
    identity: `user_${payload.id || 'admin'}`,
    ttl: 3600,
  });

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: twimlAppSid,
    incomingAllow: false,
  });

  token.addGrant(voiceGrant);

  return apiOk({ token: token.toJwt() });
}
