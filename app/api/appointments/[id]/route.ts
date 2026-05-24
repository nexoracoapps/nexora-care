import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';

const include = {
  customer: { select: { id: true, name: true, phone: true } },
  service: { select: { id: true, name: true, nameAr: true, price: true } },
  serviceProvider: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true, nameAr: true } },
};

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);

  const appointment = await prisma.appointment.findUnique({
    where: { id: params.id },
    include,
  });
  if (!appointment) return apiError('Not found', 404);
  return apiOk(appointment);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.customerId !== undefined) data.customerId = body.customerId;
  if (body.serviceId !== undefined) data.serviceId = body.serviceId;
  if (body.providerId !== undefined) data.providerId = body.providerId || null;
  if (body.dateTime !== undefined) data.dateTime = new Date(body.dateTime);
  if (body.status !== undefined) data.status = body.status;
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.amount !== undefined) data.amount = body.amount ? parseFloat(body.amount) : null;
  if (body.paymentMethod !== undefined) data.paymentMethod = body.paymentMethod || null;
  if (body.paymentStatus !== undefined) data.paymentStatus = body.paymentStatus;
  if (body.branchId !== undefined) data.branchId = body.branchId || null;

  const appointment = await prisma.appointment.update({
    where: { id: params.id },
    data,
    include,
  });

  return apiOk(appointment);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);
  if (!['ADMIN', 'MANAGER'].includes(payload.role)) return apiError('Forbidden', 403);

  await prisma.appointment.delete({ where: { id: params.id } });
  return apiOk({ message: 'Deleted' });
}
