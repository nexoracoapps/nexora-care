import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = getTokenFromRequest(req);
  if (!payload || (payload.role !== 'ADMIN' && payload.role !== 'MANAGER')) return apiError('Unauthorized', 401);
  const body = await req.json();
  const medicine = await prisma.medicine.update({
    where: { id: params.id },
    data: {
      name: body.name?.trim(),
      nameAr: body.nameAr?.trim() || null,
      category: body.category?.trim() || 'General',
      dosageOptions: JSON.stringify(Array.isArray(body.dosageOptions) ? body.dosageOptions : []),
      instructions: body.instructions?.trim() || null,
      instructionsAr: body.instructionsAr?.trim() || null,
      isActive: body.isActive !== undefined ? body.isActive : true,
    },
  });
  return apiOk(medicine);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = getTokenFromRequest(req);
  if (!payload || payload.role !== 'ADMIN') return apiError('Unauthorized', 401);
  await prisma.medicine.update({ where: { id: params.id }, data: { isActive: false } });
  return apiOk({ deleted: true });
}
