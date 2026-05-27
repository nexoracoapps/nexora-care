import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/* GET /api/cron/reminders
   - Called by Vercel Cron daily at 9 AM
   - Can also be triggered manually by ADMIN for testing
   Query params:
     hours=24   — look-ahead window in hours (default 24, max 168)
     test=true  — send a "test" ping to the calling user only (ADMIN only)

   Per-user delivery:
     - ADMIN / MANAGER users → receive reminders for all upcoming appointments
     - STAFF users → receive reminders only for appointments assigned to their linked provider
*/
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const isTest = searchParams.get('test') === 'true';
  const hours  = Math.min(Math.max(parseInt(searchParams.get('hours') ?? '24', 10) || 24, 1), 168);

  // Auth: either Vercel cron secret OR a logged-in ADMIN user
  const authHeader = req.headers.get('authorization');
  const isCron     = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const callerPayload = getTokenFromRequest(req);

  if (!isCron) {
    if (!callerPayload || callerPayload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const webpush = (await import('web-push')).default;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:noreply@nexoracare.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
    process.env.VAPID_PRIVATE_KEY ?? '',
  );

  // Test mode — send a single ping only to the calling user's subscriptions
  if (isTest && callerPayload) {
    const subs = await prisma.pushSubscription.findMany({ where: { userId: callerPayload.id } });
    if (subs.length === 0) {
      return NextResponse.json({ sent: 0, test: true, message: 'No subscriptions for your account' });
    }
    const payload = JSON.stringify({
      title: '🔔 Test Notification',
      body:  'Push notifications are working correctly on Nexora Care.',
      url:   '/calendar',
      tag:   'test-ping',
    });
    let sent = 0;
    const stale: string[] = [];
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        sent++;
      } catch (err: unknown) {
        if ((err as { statusCode?: number }).statusCode === 410) stale.push(sub.endpoint);
      }
    }
    if (stale.length > 0) await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: stale } } });
    return NextResponse.json({ sent, test: true, staleCleaned: stale.length });
  }

  // Normal mode — fetch upcoming appointments
  const now    = new Date();
  const cutoff = new Date(now.getTime() + hours * 60 * 60 * 1000);

  const upcoming = await prisma.appointment.findMany({
    where: { status: 'SCHEDULED', dateTime: { gte: now, lte: cutoff } },
    include: { customer: true, service: true },
  });

  if (upcoming.length === 0) {
    return NextResponse.json({ sent: 0, hours, message: 'No upcoming appointments in window' });
  }

  // Fetch all users with push subscriptions
  const users = await prisma.user.findMany({
    where: { fcmTokens: undefined },  // just fetch all users
    select: { id: true, role: true, providerId: true },
  });

  // Fetch all subscriptions keyed by userId
  const allSubs = await prisma.pushSubscription.findMany();
  const subsByUser = new Map<string, typeof allSubs>();
  for (const sub of allSubs) {
    if (!subsByUser.has(sub.userId)) subsByUser.set(sub.userId, []);
    subsByUser.get(sub.userId)!.push(sub);
  }

  let sent = 0;
  const stale: string[] = [];

  for (const appt of upcoming) {
    const dt      = new Date(appt.dateTime);
    const timeStr = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const dateStr = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const payload = JSON.stringify({
      title: '📅 Upcoming Appointment',
      body:  `${appt.customer?.name ?? 'Customer'} — ${appt.service?.name ?? 'Service'} at ${timeStr} on ${dateStr}`,
      url:   '/appointments',
      tag:   `appt-${appt.id}`,
    });

    for (const user of users) {
      const userSubs = subsByUser.get(user.id);
      if (!userSubs || userSubs.length === 0) continue;

      // ADMIN/MANAGER → all appointments; STAFF → only if their provider is assigned
      const shouldNotify =
        user.role === 'ADMIN' ||
        user.role === 'MANAGER' ||
        (user.providerId && appt.serviceProviderId === user.providerId);

      if (!shouldNotify) continue;

      for (const sub of userSubs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
          sent++;
        } catch (err: unknown) {
          if ((err as { statusCode?: number }).statusCode === 410) stale.push(sub.endpoint);
        }
      }
    }
  }

  if (stale.length > 0) await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: stale } } });
  return NextResponse.json({ sent, hours, appointments: upcoming.length, staleCleaned: stale.length });
}
