import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';

const include = {
  provider: { select: { id: true, name: true, type: true } },
  user: { select: { id: true, username: true } },
};

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);
  if (!['ADMIN', 'MANAGER'].includes(payload.role)) return apiError('Forbidden', 403);

  const { providerId, startDate, endDate, reason } = await req.json();
  if (!startDate || !endDate) return apiError('Start and end dates are required');

  const absence = await prisma.staffAbsence.update({
    where: { id: params.id },
    data: {
      providerId: providerId || null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason: reason || null,
    },
    include,
  });

  return apiOk(absence);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);
  if (!['ADMIN', 'MANAGER'].includes(payload.role)) return apiError('Forbidden', 403);

  await prisma.staffAbsence.delete({ where: { id: params.id } });
  return apiOk({ message: 'Deleted' });
}
