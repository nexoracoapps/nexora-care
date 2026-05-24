import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ratings = await prisma.specialistRating.findMany({
    where: { providerId: params.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, rating: true, feedback: true, reviewerName: true, createdAt: true },
  });

  return apiOk(ratings.map(r => ({
    id: r.id,
    rating: r.rating,
    comment: r.feedback,
    reviewerName: r.reviewerName ?? 'Anonymous',
    createdAt: r.createdAt,
  })));
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);

  const { rating, comment } = await req.json();
  if (!rating || rating < 1 || rating > 5) return apiError('Rating must be between 1 and 5');

  const saved = await prisma.specialistRating.create({
    data: {
      rating: Number(rating),
      feedback: comment || null,
      reviewerName: payload.username,
      providerId: params.id,
      userId: payload.id,
    },
  });

  return apiOk(saved, 201);
}
