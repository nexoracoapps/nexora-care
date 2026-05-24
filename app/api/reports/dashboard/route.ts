import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get('branchId');
  const period = searchParams.get('period') || 'month';

  const where: Record<string, unknown> = {};
  if (branchId) where.branchId = branchId;
  else if (payload.role === 'STAFF' && payload.branchId) where.branchId = payload.branchId;

  const now = new Date();
  let startDate = new Date();
  if (period === 'today') startDate = new Date(now.setHours(0,0,0,0));
  else if (period === 'week') { startDate = new Date(now); startDate.setDate(startDate.getDate() - 7); }
  else { startDate = new Date(now); startDate.setDate(1); startDate.setHours(0,0,0,0); }

  const dateWhere = { ...where, createdAt: { gte: startDate } };

  const [
    totalCustomers,
    totalProviders,
    totalServices,
    paidAppointments,
    allAppointments,
    upcomingAppointments,
    recentAppointments,
  ] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.serviceProvider.count({ where }),
    prisma.service.count(),
    prisma.appointment.findMany({
      where: { ...dateWhere, paymentStatus: 'PAID' },
      select: { amount: true },
    }),
    prisma.appointment.count({ where: dateWhere }),
    prisma.appointment.findMany({
      where: {
        ...where,
        status: 'SCHEDULED',
        dateTime: { gte: new Date() },
      },
      include: {
        customer: true,
        service: true,
        serviceProvider: true,
      },
      orderBy: { dateTime: 'asc' },
      take: 10,
    }),
    prisma.appointment.findMany({
      where: dateWhere,
      include: {
        customer: true,
        service: true,
        serviceProvider: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  const totalRevenue = paidAppointments.reduce((sum, a) => sum + (a.amount || 0), 0);

  const today = new Date();
  today.setHours(0,0,0,0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const upcomingToday = await prisma.appointment.count({
    where: {
      ...where,
      status: 'SCHEDULED',
      dateTime: { gte: today, lt: tomorrow },
    },
  });

  const noShows = await prisma.appointment.count({ where: { ...dateWhere, status: 'NO_SHOW' } });
  const unpaidCount = await prisma.appointment.count({ where: { ...dateWhere, paymentStatus: 'UNPAID' } });

  return apiOk({
    totalRevenue,
    totalCustomers,
    totalAppointments: allAppointments,
    totalProviders,
    totalServices,
    upcomingToday,
    noShows,
    unpaidCount,
    recentAppointments,
    upcomingAppointments,
  });
}
