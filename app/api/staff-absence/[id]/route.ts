import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';

const include = {
  provider: { select: { id: true, name: true, type: true } },
  user: { select: { id: true, username: true } },
};

async function canModify(payload: { id: string; role: string; providerId?: string | null }, id: string) {
  if (['ADMIN', 'MANAGER'].includes(payload.role)) return true;
  const record = await prisma.staffAbsence.findUnique({ where: { id }, select: { userId: true, providerId: true } });
  if (!record) return false;
  return record.userId === payload.id || (!!payload.providerId && record.providerId === payload.providerId);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);
  if (!await canModify(payload, params.id)) return apiError('Forbidden', 403);

  const { providerId, startDate, endDate, reason } = await req.json();
  if (!startDate || !endDate) return apiError('Start and end dates are required');

  const isPrivileged = ['ADMIN', 'MANAGER'].includes(payload.role);
  const absence = await prisma.staffAbsence.update({
    where: { id: params.id },
    data: {
      providerId: isPrivileged ? (providerId || null) : undefined,
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
  if (!await canModify(payload, params.id)) return apiError('Forbidden', 403);

  await prisma.staffAbsence.delete({ where: { id: params.id } });
  return apiOk({ message: 'Deleted' });
}
