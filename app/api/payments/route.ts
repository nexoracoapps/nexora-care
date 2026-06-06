import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const payload = await getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);
  if (!['ADMIN','MANAGER'].includes(payload.role)) return apiError('Forbidden', 403);

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get('branchId');

  const where: Record<string, unknown> = { paymentStatus: 'PAID' };
  if (branchId) where.branchId = branchId;

  const payments = await prisma.appointment.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true } },
      service: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 500,
  });

  return apiOk(payments);
}
