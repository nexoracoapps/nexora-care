import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);
  if (!['ADMIN', 'MANAGER'].includes(payload.role)) return apiError('Forbidden', 403);

  const { userId } = await req.json();

  if (!userId) {
    // Unlink: clear any user pointing to this provider
    await prisma.user.updateMany({
      where: { providerId: params.id },
      data: { providerId: null },
    });
    return apiOk({ unlinked: true });
  }

  // Clear any existing link on the target user first (they may have had another provider)
  await prisma.user.updateMany({
    where: { providerId: params.id, NOT: { id: userId } },
    data: { providerId: null },
  });

  // Set the new link
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { providerId: params.id },
    select: { id: true, username: true },
  });

  return apiOk({ linked: updated });
}
