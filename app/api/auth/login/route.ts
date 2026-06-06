import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signToken } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) return apiError('Username and password required');

    const user = await prisma.user.findUnique({
      where: { username },
      include: { branch: { select: { id: true, name: true } } },
    });

    if (!user) return apiError('Invalid credentials', 401);

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return apiError('Invalid credentials', 401);

    const token = signToken({
      id: user.id,
      username: user.username,
      role: user.role,
      branchId: user.branchId,
      providerId: user.providerId ?? null,
      tokenVersion: user.tokenVersion,
    });

    return apiOk({
      token,
      id: user.id,
      username: user.username,
      role: user.role,
      branchId: user.branchId,
      branchName: user.branch?.name ?? null,
      providerId: user.providerId ?? null,
      email: user.email,
      phone: user.phone,
    });
  } catch (e) {
    console.error(e);
    return apiError('Server error', 500);
  }
}
