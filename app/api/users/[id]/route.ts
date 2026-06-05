import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';

const SELECT = {
  id: true, username: true, email: true, phone: true,
  role: true, photoUrl: true, branchId: true,
  branch: { select: { id: true, name: true } },
  providerId: true,
  provider: { select: { id: true, name: true, type: true } },
  createdAt: true,
};

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);
  if (!['ADMIN','MANAGER'].includes(payload.role)) return apiError('Forbidden', 403);

  const user = await prisma.user.findUnique({ where: { id: params.id }, select: SELECT });
  if (!user) return apiError('Not found', 404);
  return apiOk(user);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);
  if (!['ADMIN','MANAGER'].includes(payload.role)) return apiError('Forbidden', 403);

  const { username, password, email, phone, role, branchId, photoUrl, providerId } = await req.json();
  if (!username) return apiError('Username is required');

  const conflict = await prisma.user.findFirst({
    where: { username, NOT: { id: params.id } },
  });
  if (conflict) return apiError('Username already taken');

  const data: Record<string, unknown> = {
    username,
    email: email || null,
    phone: phone || null,
    role: role || 'STAFF',
    branchId: branchId || null,
    photoUrl: photoUrl || null,
    providerId: providerId || null,
  };
  if (password) {
    data.password = await bcrypt.hash(password, 10);
  }

  const user = await prisma.user.update({ where: { id: params.id }, data, select: SELECT });
  return apiOk(user);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);
  if (!['ADMIN'].includes(payload.role)) return apiError('Forbidden — only ADMIN can delete users', 403);

  if (payload.id === params.id) return apiError('You cannot delete your own account.', 409);

  const target = await prisma.user.findUnique({ where: { id: params.id }, select: { username: true } });
  if (!target) return apiError('User not found.', 404);

  try {
    await prisma.$transaction(async (tx) => {
      // Delete all related records before removing the user
      await tx.pushSubscription.deleteMany({ where: { userId: params.id } });
      await tx.fcmToken.deleteMany({ where: { userId: params.id } });
      await tx.staffAbsence.deleteMany({ where: { userId: params.id } });
      await tx.auditLog.updateMany({ where: { userId: params.id }, data: { userId: null } });
      await tx.specialistRating.deleteMany({ where: { userId: params.id } });
      await tx.callLog.updateMany({ where: { userId: params.id }, data: { userId: null } });
      await tx.user.delete({ where: { id: params.id } });
    });
    return apiOk({ message: `User "${target.username}" and all related records deleted successfully.` });
  } catch (e: unknown) {
    console.error('User delete failed:', e);
    return apiError('Failed to delete user.', 500);
  }
}
