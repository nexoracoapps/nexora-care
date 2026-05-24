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
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);

  const { name, phone, email, branchId } = await req.json();

  const customer = await prisma.customer.update({
    where: { id: params.id },
    data: {
      ...(name && { name }),
      ...(phone !== undefined && { phone }),
      ...(email !== undefined && { email }),
      ...(branchId !== undefined && { branchId }),
    },
    include,
  });

  return apiOk(customer);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);
  if (!['ADMIN','MANAGER'].includes(payload.role)) return apiError('Forbidden', 403);

  await prisma.customer.delete({ where: { id: params.id } });
  return apiOk({ message: 'Deleted' });
}
