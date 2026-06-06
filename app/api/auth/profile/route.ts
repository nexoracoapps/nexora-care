import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest, signToken } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const payload = await getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);

  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    include: { branch: { select: { id: true, name: true } } },
  });
  if (!user) return apiError('Not found', 404);

  return apiOk({
    id: user.id,
    username: user.username,
    role: user.role,
    email: user.email,
    phone: user.phone,
    branchId: user.branchId,
    branchName: user.branch?.name ?? null,
  });
}

export async function PUT(req: NextRequest) {
  const payload = await getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);

  const { email, phone, currentPassword, newPassword } = await req.json();

  const user = await prisma.user.findUnique({ where: { id: payload.id } });
  if (!user) return apiError('Not found', 404);

  const updateData: Record<string, unknown> = {};
  if (email !== undefined) updateData.email = email;
  if (phone !== undefined) updateData.phone = phone;

  if (newPassword) {
    if (!currentPassword) return apiError('Current password required');
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return apiError('Current password is incorrect');
    updateData.password = await bcrypt.hash(newPassword, 10);
    // Invalidate all other sessions by bumping the token version
    updateData.tokenVersion = { increment: 1 };
  }

  const updated = await prisma.user.update({
    where: { id: payload.id },
    data: updateData,
  });

  // Issue a fresh token so this session stays valid after the password change
  const newToken = newPassword
    ? signToken({
        id: updated.id,
        username: updated.username,
        role: updated.role,
        branchId: updated.branchId,
        providerId: updated.providerId ?? null,
        tokenVersion: updated.tokenVersion,
      })
    : undefined;

  return apiOk({
    id: updated.id,
    username: updated.username,
    email: updated.email,
    phone: updated.phone,
    ...(newToken ? { token: newToken } : {}),
  });
}
