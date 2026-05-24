import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req);
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
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);

  const { email, phone, currentPassword, newPassword } = await req.json();

  const user = await prisma.user.findUnique({ where: { id: payload.id } });
  if (!user) return apiError('Not found', 404);

  const updateData: Record<string, string> = {};
  if (email !== undefined) updateData.email = email;
  if (phone !== undefined) updateData.phone = phone;

  if (newPassword) {
    if (!currentPassword) return apiError('Current password required');
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return apiError('Current password is incorrect');
    updateData.password = await bcrypt.hash(newPassword, 10);
  }

  const updated = await prisma.user.update({
    where: { id: payload.id },
    data: updateData,
  });

  return apiOk({ id: updated.id, username: updated.username, email: updated.email, phone: updated.phone });
}
