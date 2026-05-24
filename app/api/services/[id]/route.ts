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

  await prisma.service.delete({ where: { id: params.id } });
  return apiOk({ message: 'Deleted' });
}
