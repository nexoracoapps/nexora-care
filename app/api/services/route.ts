import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);

  const services = await prisma.service.findMany({
    orderBy: { name: 'asc' },
  });

  return apiOk(services);
}

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);
  if (!['ADMIN','MANAGER'].includes(payload.role)) return apiError('Forbidden', 403);

  const { name, nameAr, price, description } = await req.json();
  if (!name) return apiError('Name is required');

  const service = await prisma.service.create({
    data: {
      name,
      nameAr: nameAr || null,
      price: price ? parseFloat(price) : 0,
      description: description || null,
    },
  });

  return apiOk(service, 201);
}
