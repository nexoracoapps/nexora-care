import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);
  if (!['ADMIN','MANAGER'].includes(payload.role)) return apiError('Forbidden', 403);

  const { name, nameAr, address, phone } = await req.json();

  const branch = await prisma.branch.update({
    where: { id: params.id },
    data: {
      ...(name && { name }),
      ...(nameAr !== undefined && { nameAr: nameAr || null }),
      ...(address !== undefined && { address }),
      ...(phone !== undefined && { phone }),
    },
  });

  return apiOk(branch);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);
  if (!['ADMIN','MANAGER'].includes(payload.role)) return apiError('Forbidden', 403);

  await prisma.branch.delete({ where: { id: params.id } });
  return apiOk({ message: 'Deleted' });
}
