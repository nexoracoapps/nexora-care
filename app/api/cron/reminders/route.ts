import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import webpush from 'web-push';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

/* GET /api/cron/reminders — called by Vercel Cron every hour
   Sends push notifications for appointments in the next 24 h  */
export async function GET(req: NextRequest) {
  // Verify Vercel cron secret (or skip check in dev)
  const authHeader = req.headers.get('authorization');
  if (
    process.env.NODE_ENV === 'production' &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now   = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Appointments coming up in the next 24 hours
  const upcoming = await prisma.appointment.findMany({
    where: {
      status: 'SCHEDULED',
      dateTime: { gte: now, lte: in24h },
    },
    include: {
      customer: true,
      service:  true,
    },
  });

  if (upcoming.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No upcoming appointments' });
  }

  // Get all push subscriptions
  const subs = await prisma.pushSubscription.findMany();
  if (subs.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No push subscribers' });
  }

  let sent = 0;
  const stale: string[] = [];

  for (const appt of upcoming) {
    const dt = new Date(appt.dateTime);
    const timeStr = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const dateStr = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const payload = JSON.stringify({
      title: '📅 Upcoming Appointment',
      body:  `${appt.customer?.name ?? 'Customer'} — ${appt.service?.name ?? 'Service'} at ${timeStr} on ${dateStr}`,
      url:   '/appointments',
      tag:   `appt-${appt.id}`,
    });

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (err: unknown) {
        // 410 Gone = subscription expired; collect for cleanup
        if ((err as { statusCode?: number }).statusCode === 410) stale.push(sub.endpoint);
      }
    }
  }

  // Clean up expired subscriptions
  if (stale.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: stale } } });
  }

  return NextResponse.json({ sent, appointments: upcoming.length, staleCleaned: stale.length });
}
