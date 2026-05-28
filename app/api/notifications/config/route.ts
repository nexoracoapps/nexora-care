import { NextRequest } from 'next/server';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';
import { isEmailConfigured } from '@/lib/email';
import { prisma } from '@/lib/prisma';

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

  const setting = await prisma.systemSetting.findUnique({ where: { key: 'reminderLeadMinutes' } });
  const reminderLeadMinutes = parseInt(setting?.value ?? '60', 10) || 60;

  return apiOk({ emailEnabled: isEmailConfigured(), smsEnabled, reminderLeadMinutes });
}

export async function PUT(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload || payload.role !== 'ADMIN') return apiError('Unauthorized', 401);

  const { reminderLeadMinutes } = await req.json();
  const value = parseInt(String(reminderLeadMinutes), 10);
  if (!value || value < 5 || value > 1440) return apiError('Value must be between 5 and 1440 minutes', 400);

  await prisma.systemSetting.upsert({
    where:  { key: 'reminderLeadMinutes' },
    update: { value: String(value) },
    create: { key: 'reminderLeadMinutes', value: String(value) },
  });

  return apiOk({ reminderLeadMinutes: value });
}
