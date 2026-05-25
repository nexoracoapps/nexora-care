import { prisma } from '@/lib/prisma';
import { apiOk } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [specialistCount, customerCount, allRatings] = await Promise.all([
    prisma.serviceProvider.count(),
    prisma.customer.count(),
    prisma.specialistRating.findMany({ select: { rating: true } }),
  ]);

  const avgSatisfaction = allRatings.length
    ? Math.round((allRatings.reduce((s, r) => s + r.rating, 0) / allRatings.length) * 20)
    : 98;

  return apiOk({
    specialists: specialistCount,
    clients: customerCount,
    satisfaction: avgSatisfaction,
  });
}
