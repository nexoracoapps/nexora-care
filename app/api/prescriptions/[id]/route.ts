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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = await getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);
  const p = await prisma.prescription.findUnique({ where: { id: params.id }, include });
  if (!p) return apiError('Not found', 404);
  return apiOk(p);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = await getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);
  const { notes, items } = await req.json();

  await prisma.prescriptionItem.deleteMany({ where: { prescriptionId: params.id } });

  const prescription = await prisma.prescription.update({
    where: { id: params.id },
    data: {
      notes: notes || null,
      updatedAt: new Date(),
      items: {
        create: (items || []).map((item: { medicineId: string; dosage?: string; frequency?: string; duration?: string; notes?: string }) => ({
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

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = await getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);
  await prisma.prescription.delete({ where: { id: params.id } });
  return apiOk({ deleted: true });
}
