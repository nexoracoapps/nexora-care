import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

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

  return NextResponse.json(
    { specialists: specialistCount, clients: customerCount, satisfaction: avgSatisfaction },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'CDN-Cache-Control': 'no-store',
        'Vercel-CDN-Cache-Control': 'no-store',
      },
    },
  );
}
