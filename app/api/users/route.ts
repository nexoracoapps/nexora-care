import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);
  if (!['ADMIN','MANAGER'].includes(payload.role)) return apiError('Forbidden', 403);

  const users = await prisma.user.findMany({
    select: {
      id: true, username: true, email: true, phone: true,
      role: true, photoUrl: true, branchId: true,
      branch: { select: { id: true, name: true, nameAr: true } },
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return apiOk(users);
}

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);
  if (!['ADMIN','MANAGER'].includes(payload.role)) return apiError('Forbidden', 403);

  const { username, password, email, phone, role, branchId, photoUrl } = await req.json();
  if (!username || !password) return apiError('Username and password required');

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return apiError('Username already taken');

  const hashed = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      username,
      password: hashed,
      email: email || null,
      phone: phone || null,
      role: role || 'STAFF',
      photoUrl: photoUrl || null,
      branchId: branchId || null,
    },
    select: {
      id: true, username: true, email: true, phone: true,
      role: true, photoUrl: true, branchId: true,
      branch: { select: { id: true, name: true, nameAr: true } },
      createdAt: true,
    },
  });

  return apiOk(user, 201);
}
