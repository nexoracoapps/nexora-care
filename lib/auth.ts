import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'nexora-care-secret';

export interface TokenPayload {
  id: string;
  username: string;
  role: string;
  branchId: string | null;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export function getTokenFromRequest(req: NextRequest): TokenPayload | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  return verifyToken(token);
}

export function requireAuth(req: NextRequest): TokenPayload {
  const payload = getTokenFromRequest(req);
  if (!payload) throw new Error('Unauthorized');
  return payload;
}

export function requireAdmin(req: NextRequest): TokenPayload {
  const payload = requireAuth(req);
  if (payload.role !== 'ADMIN') throw new Error('Forbidden');
  return payload;
}
