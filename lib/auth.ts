import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'nexora-care-secret';

export interface TokenPayload {
  id: string;
  username: string;
  role: string;
  branchId: string | null;
  providerId: string | null;
  tokenVersion: number;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '365d' });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export async function getTokenFromRequest(req: NextRequest): Promise<TokenPayload | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) return null;

  // Reject tokens whose version no longer matches the DB (e.g. password was changed)
  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { tokenVersion: true },
  });
  if (!user || user.tokenVersion !== (payload.tokenVersion ?? 0)) return null;

  return payload;
}

export async function requireAuth(req: NextRequest): Promise<TokenPayload> {
  const payload = await getTokenFromRequest(req);
  if (!payload) throw new Error('Unauthorized');
  return payload;
}

export async function requireAdmin(req: NextRequest): Promise<TokenPayload> {
  const payload = await requireAuth(req);
  if (payload.role !== 'ADMIN') throw new Error('Forbidden');
  return payload;
}
