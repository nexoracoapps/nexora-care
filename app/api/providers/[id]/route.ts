import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';

const include = {
  branch: { select: { id: true, name: true, nameAr: true } },
  linkedUser: { select: { id: true, username: true } },
};

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);
  if (!['ADMIN', 'MANAGER'].includes(payload.role)) return apiError('Forbidden', 403);

  const { name, type, bio, photoUrl, branchId, revenuePercentage } = await req.json();

  const provider = await prisma.serviceProvider.update({
    where: { id: params.id },
    data: {
      ...(name && { name }),
      ...(type && { type }),
      ...(bio !== undefined && { bio }),
      ...(photoUrl !== undefined && { photoUrl }),
      ...(branchId !== undefined && { branchId }),
      ...(revenuePercentage !== undefined && { revenuePercentage: Math.min(100, Math.max(0, Number(revenuePercentage))) }),
    },
    include,
  });

  return apiOk(provider);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);
  if (!['ADMIN', 'MANAGER'].includes(payload.role)) return apiError('Forbidden', 403);

  const provider = await prisma.serviceProvider.findUnique({
    where: { id: params.id },
    select: { name: true },
  });
  if (!provider) return apiError('Provider not found.', 404);

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Nullify provider on appointments (keep appointment history)
      await tx.appointment.updateMany({
        where: { serviceProviderId: params.id },
        data: { serviceProviderId: null },
      });
      // 2. Delete staff absences / vacations
      await tx.staffAbsence.deleteMany({ where: { providerId: params.id } });
      // 3. Delete specialist ratings
      await tx.specialistRating.deleteMany({ where: { providerId: params.id } });
      // 4. Unlink from users
      await tx.user.updateMany({
        where: { providerId: params.id },
        data: { providerId: null },
      });
      // 5. Delete the provider
      await tx.serviceProvider.delete({ where: { id: params.id } });
    });
    return apiOk({ message: `Provider "${provider.name}" deleted. Appointments kept with provider unassigned.` });
  } catch (e: unknown) {
    console.error('Provider delete failed:', e);
    return apiError('Failed to delete provider.', 500);
  }
}
