import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const payload = await getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get('customerId');

  const where: Record<string, unknown> = {};
  if (customerId) where.customerId = customerId;

  const logs = await prisma.callLog.findMany({
    where,
    include: { customer: { select: { id: true, name: true, phone: true } } },
    orderBy: { startedAt: 'desc' },
    take: 200,
  });

  return apiOk(logs);
}

export async function DELETE(req: NextRequest) {
  const payload = await getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);

  await prisma.callLog.deleteMany({});
  return apiOk({ cleared: true });
}

export async function POST(req: NextRequest) {
  const payload = await getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);

  const { customerId, customerName, durationSeconds, status, notes } = await req.json();

  const log = await prisma.callLog.create({
    data: {
      customerId: customerId || null,
      customerName: customerName || null,
      endedAt: new Date(),
      durationSeconds: durationSeconds || null,
      status: status || 'COMPLETED',
      notes: notes || null,
    },
    include: { customer: { select: { id: true, name: true, phone: true } } },
  });

  return apiOk(log, 201);
}
