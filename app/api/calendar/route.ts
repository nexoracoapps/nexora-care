import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from       = searchParams.get('from');
  const to         = searchParams.get('to');
  const providerId = searchParams.get('providerId');
  const branchId   = searchParams.get('branchId') ?? (payload.role === 'STAFF' ? payload.branchId : null);

  const where: Record<string, unknown> = {};
  if (from || to) {
    where.dateTime = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to   ? { lte: new Date(to)   } : {}),
    };
  }
  if (providerId) where.serviceProviderId = providerId;
  if (branchId)   where.branchId = branchId;

  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      customer:        { select: { id: true, name: true, phone: true } },
      service:         { select: { id: true, name: true, price: true } },
      serviceProvider: { select: { id: true, name: true, type: true } },
      branch:          { select: { id: true, name: true } },
    },
    orderBy: { dateTime: 'asc' },
  });

  return NextResponse.json(appointments);
}
