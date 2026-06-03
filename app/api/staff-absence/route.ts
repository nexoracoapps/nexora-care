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

  const where: Record<string, unknown> = {};
  if (!['ADMIN', 'MANAGER'].includes(payload.role)) {
    // Staff: only see their own absence records (matched by userId or providerId)
    const conditions: Record<string, unknown>[] = [];
    if (payload.id)         conditions.push({ userId:     payload.id });
    if (payload.providerId) conditions.push({ providerId: payload.providerId });
    where.OR = conditions.length > 0 ? conditions : [{ id: '__none__' }];
  }

  const absences = await prisma.staffAbsence.findMany({
    where,
    include,
    orderBy: { startDate: 'desc' },
  });

  return apiOk(absences);
}

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);

  const { providerId, userId, startDate, endDate, reason } = await req.json();
  if (!startDate || !endDate) return apiError('Start and end dates are required');

  const isPrivileged = ['ADMIN', 'MANAGER'].includes(payload.role);

  // Staff can only submit for themselves
  const resolvedProviderId = isPrivileged ? (providerId || null) : (payload.providerId || null);
  const resolvedUserId     = isPrivileged ? (userId || null)     : payload.id;

  const absence = await prisma.staffAbsence.create({
    data: {
      providerId: resolvedProviderId,
      userId:     resolvedUserId,
      startDate:  new Date(startDate),
      endDate:    new Date(endDate),
      reason:     reason || null,
    },
    include,
  });

  return apiOk(absence, 201);
}
