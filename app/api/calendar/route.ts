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
  if (providerId) {
    // Filter by provider only — don't restrict by branch so providers see
    // all their appointments even if some were created under "All Branches"
    where.serviceProviderId = providerId;
  } else if (branchId) {
    // No provider filter: show all appointments for the branch, including
    // those created without a branch (branchId null) so nothing is hidden
    where.OR = [{ branchId }, { branchId: null }];
  }

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
