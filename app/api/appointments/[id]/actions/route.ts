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
    // ── Manual admin override: force-complete regardless of payment ──
    case 'complete':
      data.status = 'COMPLETED';
      break;

    case 'no-show':
      data.status = 'NO_SHOW';
      break;

    case 'cancel':
      data.status = 'CANCELLED';
      break;

    // ── Service lifecycle ──
    case 'start-service':
      data.status = 'IN_PROGRESS';
      data.serviceStatus = 'IN_PROGRESS';
      break;

    // Deliver actions: update serviceStatus only — status stays IN_PROGRESS until paid
    case 'deliver':
      data.serviceStatus = 'DELIVERED';
      if (notes !== undefined) data.deliveryNotes = notes;
      if (nextVisit !== undefined) data.nextVisit = nextVisit;
      break;

    case 'partial-deliver':
      data.serviceStatus = 'PARTIAL';
      if (notes !== undefined) data.deliveryNotes = notes;
      if (nextVisit !== undefined) data.nextVisit = nextVisit;
      break;

    case 'not-deliver':
      data.status = 'NO_SHOW';
      data.serviceStatus = 'NOT_DELIVERED';
      if (notes !== undefined) data.deliveryNotes = notes;
      break;

    // ── Payment: auto-complete on payment for any active appointment ──
    case 'pay': {
      data.paymentStatus = 'PAID';
      if (paymentMethod) data.paymentMethod = paymentMethod;
      if (amount !== undefined) data.amount = parseFloat(amount);
      const current = await prisma.appointment.findUnique({
        where: { id: params.id },
        select: { status: true },
      });
      if (current && current.status !== 'CANCELLED' && current.status !== 'NO_SHOW') {
        data.status = 'COMPLETED';
      }
      break;
    }

    case 'unpay':
      data.paymentStatus = 'UNPAID';
      data.paymentMethod = null;
      // Revert to IN_PROGRESS if service was delivered, otherwise SCHEDULED
      {
        const current = await prisma.appointment.findUnique({
          where: { id: params.id },
          select: { serviceStatus: true },
        });
        const hasServiceStarted = current && current.serviceStatus !== 'PENDING';
        data.status = hasServiceStarted ? 'IN_PROGRESS' : 'SCHEDULED';
      }
      break;

    case 'reschedule':
      if (dateTime) data.dateTime = new Date(dateTime);
      data.status = 'SCHEDULED';
      data.serviceStatus = 'PENDING';
      break;

    default:
      return apiError('Unknown action');
  }

  const appointment = await prisma.appointment.update({
    where: { id: params.id },
    data,
    include,
  });

  const pushAction =
    action === 'cancel' ? 'cancelled'
    : action === 'reschedule' ? 'rescheduled'
    : action === 'complete' || action === 'pay' ? 'completed'
    : action === 'no-show' || action === 'not-deliver' ? 'no-show'
    : 'updated';
  notifyAppointment(appointment, pushAction).catch(() => {});

  return apiOk(appointment);
}
