import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);
  if (!['ADMIN','MANAGER'].includes(payload.role)) return apiError('Forbidden', 403);

  const { name, nameAr, price, description } = await req.json();

  const service = await prisma.service.update({
    where: { id: params.id },
    data: {
      ...(name && { name }),
      ...(nameAr !== undefined && { nameAr: nameAr || null }),
      ...(price !== undefined && { price: parseFloat(price) }),
      ...(description !== undefined && { description }),
    },
  });

  return apiOk(service);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);
  if (!['ADMIN','MANAGER'].includes(payload.role)) return apiError('Forbidden', 403);

  const service = await prisma.service.findUnique({ where: { id: params.id }, select: { name: true } });
  if (!service) return apiError('Service not found.', 404);

  try {
    await prisma.$transaction(async (tx) => {
      // Nullify service on appointments (preserve appointment history)
      await tx.appointment.updateMany({
        where: { serviceId: params.id },
        data: { serviceId: null },
      });
      // Delete prescription items linked to this service's medicines (via appointments)
      // Services don't link directly to prescriptions — safe to delete
      await tx.service.delete({ where: { id: params.id } });
    });
    return apiOk({ message: `Service "${service.name}" deleted. Existing appointments kept with service unassigned.` });
  } catch (e: unknown) {
    console.error('Service delete failed:', e);
    return apiError('Failed to delete service.', 500);
  }
}
