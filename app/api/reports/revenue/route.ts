import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get('branchId') ?? (payload.role === 'STAFF' ? payload.branchId : null);

  const fromRaw = searchParams.get('from');
  const toRaw   = searchParams.get('to');
  const from = fromRaw ? new Date(fromRaw) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to   = toRaw   ? new Date(toRaw)   : new Date();
  to.setHours(23, 59, 59, 999);

  const apptWhere: Record<string, unknown> = {
    dateTime: { gte: from, lte: to },
  };
  if (branchId) apptWhere.branchId = branchId;

  const [appointments, providers] = await Promise.all([
    prisma.appointment.findMany({
      where: apptWhere,
      include: {
        serviceProvider: { select: { id: true, name: true, type: true, revenuePercentage: true } },
        service:         { select: { id: true, name: true } },
        customer:        { select: { id: true, name: true } },
      },
      orderBy: { dateTime: 'asc' },
    }),
    prisma.serviceProvider.findMany({
      where: branchId ? { branchId } : {},
      select: { id: true, name: true, type: true, revenuePercentage: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const totalRevenue = appointments.reduce((s, a) => s + (a.amount ?? 0), 0);
  const paidRevenue  = appointments.filter(a => a.paymentStatus === 'PAID').reduce((s, a) => s + (a.amount ?? 0), 0);

  const byProvider = providers.map(p => {
    const mine = appointments.filter(a => a.serviceProviderId === p.id);
    const revenue = mine.reduce((s, a) => s + (a.amount ?? 0), 0);
    const paid    = mine.filter(a => a.paymentStatus === 'PAID').reduce((s, a) => s + (a.amount ?? 0), 0);
    const payout  = totalRevenue > 0 ? (totalRevenue * (p.revenuePercentage / 100)) : 0;
    return {
      provider: { id: p.id, name: p.name, type: p.type, revenuePercentage: p.revenuePercentage },
      appointmentCount: mine.length,
      revenue,
      paidRevenue: paid,
      payout,
      appointments: mine.map(a => ({
        id: a.id,
        dateTime: a.dateTime,
        customer: a.customer?.name ?? '—',
        service:  a.service?.name  ?? '—',
        amount:   a.amount,
        paymentStatus: a.paymentStatus,
        status: a.status,
      })),
    };
  });

  const unassigned = appointments.filter(a => !a.serviceProviderId);

  return NextResponse.json({
    period:           { from: from.toISOString(), to: to.toISOString() },
    totalRevenue,
    paidRevenue,
    totalAppointments: appointments.length,
    totalDistributed: byProvider.reduce((s, p) => s + p.payout, 0),
    byProvider,
    unassigned: {
      count:   unassigned.length,
      revenue: unassigned.reduce((s, a) => s + (a.amount ?? 0), 0),
    },
  });
}
