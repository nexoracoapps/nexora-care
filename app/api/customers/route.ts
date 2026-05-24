import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get('branchId');
  const search = searchParams.get('search');

  const where: Record<string, unknown> = {};
  if (branchId) where.branchId = branchId;
  else if (payload.role === 'STAFF' && payload.branchId) where.branchId = payload.branchId;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const customers = await prisma.customer.findMany({
    where,
    include: {
      branch: { select: { id: true, name: true, nameAr: true } },
      _count: { select: { appointments: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return apiOk(customers);
}

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);

  const { name, phone, email, branchId } = await req.json();
  if (!name) return apiError('Name is required');

  const customer = await prisma.customer.create({
    data: {
      name,
      phone: phone || null,
      email: email || null,
      branchId: branchId || payload.branchId || null,
    },
    include: {
      branch: { select: { id: true, name: true, nameAr: true } },
      _count: { select: { appointments: true } },
    },
  });

  return apiOk(customer, 201);
}
