import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';

const include = {
  provider: { select: { id: true, name: true, type: true } },
  user: { select: { id: true, username: true } },
};

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);

  const absences = await prisma.staffAbsence.findMany({
    include,
    orderBy: { startDate: 'desc' },
  });

  return apiOk(absences);
}

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);
  if (!['ADMIN','MANAGER'].includes(payload.role)) return apiError('Forbidden', 403);

  const { providerId, userId, startDate, endDate, reason } = await req.json();
  if (!startDate || !endDate) return apiError('Start and end dates are required');

  const absence = await prisma.staffAbsence.create({
    data: {
      providerId: providerId || null,
      userId: userId || null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason: reason || null,
    },
    include,
  });

  return apiOk(absence, 201);
}
