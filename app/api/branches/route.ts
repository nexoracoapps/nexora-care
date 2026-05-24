import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);

  const branches = await prisma.branch.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { users: true, customers: true, appointments: true } },
    },
  });

  return apiOk(branches);
}

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);
  if (!['ADMIN','MANAGER'].includes(payload.role)) return apiError('Forbidden', 403);

  const { name, nameAr, address, phone } = await req.json();
  if (!name) return apiError('Name is required');

  const branch = await prisma.branch.create({
    data: { name, nameAr: nameAr || null, address: address || null, phone: phone || null },
  });

  return apiOk(branch, 201);
}
