import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);
  const medicines = await prisma.medicine.findMany({
    where: { isActive: true },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
  return apiOk(medicines);
}

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload || payload.role !== 'ADMIN') return apiError('Unauthorized', 401);
  const body = await req.json();
  const { name, nameAr, category, dosageOptions, instructions, instructionsAr } = body;
  if (!name?.trim()) return apiError('Name is required', 400);
  const medicine = await prisma.medicine.create({
    data: {
      name: name.trim(),
      nameAr: nameAr?.trim() || null,
      category: category?.trim() || 'General',
      dosageOptions: JSON.stringify(Array.isArray(dosageOptions) ? dosageOptions : []),
      instructions: instructions?.trim() || null,
      instructionsAr: instructionsAr?.trim() || null,
    },
  });
  return apiOk(medicine);
}
