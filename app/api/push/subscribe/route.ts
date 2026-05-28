import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';

/* POST /api/push/subscribe — save a browser push subscription */
export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { endpoint, keys } = await req.json();
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 });
  }

  // Remove any old subscriptions for this user on this device path before saving the new one
  // (Each re-subscribe generates a new FCM endpoint; old ones accumulate as stale otherwise)
  await prisma.pushSubscription.deleteMany({
    where: { userId: payload.id, NOT: { endpoint } },
  });
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { p256dh: keys.p256dh, auth: keys.auth, userId: payload.id },
    create: { userId: payload.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
  });

  return NextResponse.json({ ok: true });
}

/* DELETE /api/push/subscribe — remove subscription on logout */
export async function DELETE(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { endpoint } = await req.json().catch(() => ({}));
  if (endpoint) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: payload.id } });
  } else {
    // remove all for this user (logout)
    await prisma.pushSubscription.deleteMany({ where: { userId: payload.id } });
  }

  return NextResponse.json({ ok: true });
}
