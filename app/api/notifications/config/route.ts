import { NextRequest } from 'next/server';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';
import { isEmailConfigured } from '@/lib/email';

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);

  const smsEnabled = !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER &&
    process.env.TWILIO_AUTH_TOKEN !== 'your_auth_token' &&
    !process.env.TWILIO_PHONE_NUMBER.includes('1234567890')
  );

  return apiOk({
    emailEnabled: isEmailConfigured(),
    smsEnabled,
  });
}
