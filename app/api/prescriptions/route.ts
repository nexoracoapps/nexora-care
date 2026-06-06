import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const include = {
  customer: { select: { id: true, name: true, phone: true } },
  appointment: { select: { id: true, dateTime: true, service: { select: { name: true } } } },
  items: {
    include: {
      medicine: { select: { id: true, name: true, nameAr: true, category: true, instructions: true, instructionsAr: true } },
    },
  },
};

export async function GET(req: NextRequest) {
  const payload = await getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);
  const { searchParams } = new URL(req.url);
  const customerId    = searchParams.get('customerId');
  const appointmentId = searchParams.get('appointmentId');

  const prescriptions = await prisma.prescription.findMany({
    where: {
      ...(customerId    ? { customerId }    : {}),
      ...(appointmentId ? { appointmentId } : {}),
    },
    include,
    orderBy: { createdAt: 'desc' },
  });
  return apiOk(prescriptions);
}

export async function POST(req: NextRequest) {
  const payload = await getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);

  const { customerId, appointmentId, notes, items } = await req.json();
  if (!customerId) return apiError('customerId is required', 400);
  if (!Array.isArray(items) || items.length === 0) return apiError('At least one medicine is required', 400);

  const prescription = await prisma.prescription.create({
    data: {
      customerId,
      appointmentId: appointmentId || null,
      notes: notes || null,
      createdById: payload.id,
      items: {
        create: items.map((item: { medicineId: string; dosage?: string; frequency?: string; duration?: string; notes?: string }) => ({
          medicineId: item.medicineId,
          dosage:     item.dosage     || null,
          frequency:  item.frequency  || null,
          duration:   item.duration   || null,
          notes:      item.notes      || null,
        })),
      },
    },
    include,
  });
  return apiOk(prescription);
}
