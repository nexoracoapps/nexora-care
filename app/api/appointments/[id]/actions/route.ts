import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';
import { notifyAppointment } from '@/lib/push';

const include = {
  customer: { select: { id: true, name: true, phone: true } },
  service: { select: { id: true, name: true, nameAr: true, price: true } },
  serviceProvider: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true, nameAr: true } },
};

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);

  const { action, paymentMethod, amount, notes, nextVisit, dateTime } = await req.json();

  const data: Record<string, unknown> = {};

  switch (action) {
    case 'complete':
      data.status = 'COMPLETED';
      break;
    case 'no-show':
      data.status = 'NO_SHOW';
      break;
    case 'cancel':
      data.status = 'CANCELLED';
      break;
    case 'start-service':
      data.status = 'IN_PROGRESS';
      break;
    case 'pay':
      data.paymentStatus = 'PAID';
      if (paymentMethod) data.paymentMethod = paymentMethod;
      if (amount !== undefined) data.amount = parseFloat(amount);
      break;
    case 'unpay':
      data.paymentStatus = 'UNPAID';
      data.paymentMethod = null;
      break;
    case 'reschedule':
      if (dateTime) data.dateTime = new Date(dateTime);
      data.status = 'SCHEDULED';
      break;
    case 'deliver':
      data.status = 'COMPLETED';
      if (notes !== undefined) data.notes = notes;
      break;
    case 'partial-deliver':
      data.status = 'COMPLETED';
      if (notes !== undefined) data.notes = notes;
      break;
    case 'not-deliver':
      data.status = 'NO_SHOW';
      if (notes !== undefined) data.notes = notes;
      break;
    default:
      return apiError('Unknown action');
  }

  const appointment = await prisma.appointment.update({
    where: { id: params.id },
    data,
    include,
  });

  const pushAction = action === 'cancel' ? 'cancelled'
    : action === 'reschedule' ? 'rescheduled'
    : action === 'complete' || action === 'deliver' || action === 'partial-deliver' ? 'completed'
    : action === 'no-show' || action === 'not-deliver' ? 'no-show'
    : 'updated';
  notifyAppointment(appointment, pushAction).catch(() => {});

  return apiOk(appointment);
}
