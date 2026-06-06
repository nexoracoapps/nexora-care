import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';

const include = {
  branch: { select: { id: true, name: true } },
  _count: { select: { appointments: true } },
};

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const customer = await prisma.customer.findUnique({ where: { id: params.id }, include });
  if (!customer) return apiError('Not found', 404);
  return apiOk(customer);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = await getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);

  const { name, phone, email, country, branchId } = await req.json();

  const customer = await prisma.customer.update({
    where: { id: params.id },
    data: {
      ...(name && { name }),
      ...(phone !== undefined && { phone }),
      ...(email !== undefined && { email }),
      ...(country !== undefined && { country }),
      ...(branchId !== undefined && { branchId }),
    },
    include,
  });

  return apiOk(customer);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = await getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);
  if (!['ADMIN','MANAGER'].includes(payload.role)) return apiError('Forbidden', 403);

  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    select: { name: true },
  });
  if (!customer) return apiError('Customer not found.', 404);

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Delete prescription items → prescriptions
      const prescriptions = await tx.prescription.findMany({
        where: { customerId: params.id },
        select: { id: true },
      });
      if (prescriptions.length > 0) {
        await tx.prescriptionItem.deleteMany({ where: { prescriptionId: { in: prescriptions.map(p => p.id) } } });
        await tx.prescription.deleteMany({ where: { customerId: params.id } });
      }
      // 2. Delete specialist ratings
      await tx.specialistRating.deleteMany({
        where: { appointment: { customerId: params.id } },
      });
      // 3. Delete reminder sent records (no relation on ReminderSent — resolve via appointment IDs)
      const apptIds = (await tx.appointment.findMany({ where: { customerId: params.id }, select: { id: true } })).map(a => a.id);
      if (apptIds.length > 0) {
        await tx.reminderSent.deleteMany({ where: { appointmentId: { in: apptIds } } });
      }
      // 4. Delete appointments
      await tx.appointment.deleteMany({ where: { customerId: params.id } });
      // 5. Delete call logs
      await tx.callLog.deleteMany({ where: { customerId: params.id } });
      // 6. Delete the customer
      await tx.customer.delete({ where: { id: params.id } });
    });
    return apiOk({ message: `Customer "${customer.name}" and all related records deleted successfully.` });
  } catch (e: unknown) {
    console.error('Customer delete failed:', e);
    return apiError('Failed to delete customer.', 500);
  }
}
