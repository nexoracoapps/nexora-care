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

  await prisma.serviceProvider.delete({ where: { id: params.id } });
  return apiOk({ message: 'Deleted' });
}
