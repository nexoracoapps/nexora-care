import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';

const include = {
  branch: { select: { id: true, name: true, nameAr: true } },
  linkedUser: { select: { id: true, username: true } },
};

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get('branchId');

  const where: Record<string, unknown> = {};
  if (branchId) where.branchId = branchId;
  else if (payload.role === 'STAFF' && payload.branchId) where.branchId = payload.branchId;

  const providers = await prisma.serviceProvider.findMany({
    where,
    include,
    orderBy: { name: 'asc' },
  });

  return apiOk(providers);
}

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);
  if (!['ADMIN','MANAGER'].includes(payload.role)) return apiError('Forbidden', 403);

  const { name, type, bio, photoUrl, branchId } = await req.json();
  if (!name) return apiError('Name is required');

  const provider = await prisma.serviceProvider.create({
    data: {
      name,
      type: type || 'THERAPIST',
      bio: bio || null,
      photoUrl: photoUrl || null,
      branchId: branchId || payload.branchId || null,
    },
    include,
  });

  return apiOk(provider, 201);
}
