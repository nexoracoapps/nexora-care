import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = await getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);

  const appointments = await prisma.appointment.findMany({
    where: { customerId: params.id },
    include: {
      service: true,
      serviceProvider: true,
      branch: { select: { id: true, name: true } },
    },
    orderBy: { dateTime: 'desc' },
  });

  return apiOk(appointments);
}
