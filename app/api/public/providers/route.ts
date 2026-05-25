import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest) {
  const providers = await prisma.serviceProvider.findMany({
    orderBy: { name: 'asc' },
    include: {
      ratings: { select: { rating: true } },
    },
  });

  const result = providers.map(p => {
    const total = p.ratings.length;
    const avg = total ? (p.ratings.reduce((s, r) => s + r.rating, 0) / total) : null;
    return {
      id: p.id,
      name: p.name,
      type: p.type,
      bio: p.bio,
      photoUrl: p.photoUrl,
      avgRating: avg ? avg.toFixed(1) : null,
      totalRatings: total,
    };
  });

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}
