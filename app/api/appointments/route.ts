import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';

const include = {
  customer: true,
  service: true,
  serviceProvider: true,
  branch: { select: { id: true, name: true, nameAr: true } },
};

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get('branchId');
  const status = searchParams.get('status');
  const page = parseInt(searchParams.get('page') || '0');
  const size = parseInt(searchParams.get('size') || '500');

  const where: Record<string, unknown> = {};
  if (payload.providerId) {
    // Provider-linked user: see only their own appointments regardless of branch
    where.serviceProviderId = payload.providerId;
  } else if (branchId) {
    where.branchId = branchId;
  } else if (payload.role === 'STAFF' && payload.branchId) {
    where.branchId = payload.branchId;
  }
  if (status) where.status = status;

  const appointments = await prisma.appointment.findMany({
    where,
    include,
    orderBy: { dateTime: 'desc' },
    skip: page * size,
    take: size,
  });

  return apiOk(appointments);
}

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);

  const body = await req.json();
  const {
    dateTime, customerId, serviceId, serviceProviderId,
    branchId, notes, amount, paymentMethod,
  } = body;

  if (!dateTime) return apiError('Date/time is required');

  const appointment = await prisma.appointment.create({
    data: {
      dateTime: new Date(dateTime),
      customerId: customerId || null,
      serviceId: serviceId || null,
      serviceProviderId: serviceProviderId || null,
      branchId: branchId || payload.branchId || null,
      notes: notes || null,
      amount: amount ? parseFloat(amount) : null,
      paymentMethod: paymentMethod || null,
    },
    include,
  });

  return apiOk(appointment, 201);
}
