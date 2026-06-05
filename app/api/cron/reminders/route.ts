import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const DEFAULT_LEAD_MINUTES = 60;
const CRON_WINDOW_MINUTES  = 35; // half-window around the lead time to catch each appointment once

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const isTest = searchParams.get('test') === 'true';

  // Auth: either Vercel cron secret OR a logged-in user
  const authHeader    = req.headers.get('authorization');
  const isCron        = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const callerPayload = getTokenFromRequest(req);

  if (!isCron && !callerPayload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const vapidPublic  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY ?? '';
  const vapidSubject = process.env.VAPID_SUBJECT ?? 'mailto:noreply@nexoracare.com';

  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json({ error: 'VAPID keys not configured on server', vapidPublicSet: !!vapidPublic, vapidPrivateSet: !!vapidPrivate }, { status: 503 });
  }

  const webpush = (await import('web-push')).default;
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  } catch (err) {
    return NextResponse.json({ error: 'Invalid VAPID keys', detail: String(err) }, { status: 503 });
  }

  // Test mode — send a single ping to the calling user's subscriptions
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

  const now      = new Date();
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
  const dayEnd   = new Date(now); dayEnd.setHours(23, 59, 59, 999);

  // Fetch configured lead time
  const setting     = await prisma.systemSetting.findUnique({ where: { key: 'reminderLeadMinutes' } });
  const leadMinutes = parseInt(setting?.value ?? String(DEFAULT_LEAD_MINUTES), 10) || DEFAULT_LEAD_MINUTES;

  // Cron with lead-time window: only appointments that are ~leadMinutes away right now
  // Manual trigger: all remaining SCHEDULED appointments today (for admin refresh)
  const upcomingWhere = isCron
    ? {
        status: 'SCHEDULED' as const,
        dateTime: {
          gte: new Date(now.getTime() + (leadMinutes - CRON_WINDOW_MINUTES) * 60_000),
          lte: new Date(now.getTime() + (leadMinutes + CRON_WINDOW_MINUTES) * 60_000),
        },
      }
    : { status: 'SCHEDULED' as const, dateTime: { gte: dayStart, lte: dayEnd } };

  const upcoming = await prisma.appointment.findMany({
    where: upcomingWhere,
    include: { customer: true, service: true },
    orderBy: { dateTime: 'asc' },
  });

  if (upcoming.length === 0) {
    return NextResponse.json({ sent: 0, leadMinutes, message: 'No appointments in reminder window' });
  }

  // Cron deduplicates; manual trigger always resends
  const toNotify = isCron ? await (async () => {
    const alreadySent = await prisma.reminderSent.findMany({
      where: { appointmentId: { in: upcoming.map(a => a.id) }, sentAt: { gte: dayStart } },
      select: { appointmentId: true },
    });
    const sentIds = new Set(alreadySent.map(r => r.appointmentId));
    return upcoming.filter(a => !sentIds.has(a.id));
  })() : upcoming;

  if (toNotify.length === 0) {
    return NextResponse.json({ sent: 0, message: 'All appointments in window already notified' });
  }

  // Fetch ALL push subscriptions — every user who opted in gets notified
  const allSubs    = await prisma.pushSubscription.findMany();
  const subsByUser = new Map<string, typeof allSubs>();
  for (const sub of allSubs) {
    if (!subsByUser.has(sub.userId)) subsByUser.set(sub.userId, []);
    subsByUser.get(sub.userId)!.push(sub);
  }

  // All users who have at least one subscription
  const subscribedUserIds = Array.from(subsByUser.keys());

  let sent = 0;
  const stale: string[] = [];

  for (const appt of toNotify) {
    const dt      = new Date(appt.dateTime);
    const timeStr = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const payload = JSON.stringify({
      title: `📅 Upcoming Appointment — ${timeStr}`,
      body:  `${appt.customer?.name ?? 'Customer'} · ${appt.service?.name ?? 'Service'}`,
      url:   '/appointments',
      tag:   `appt-${appt.id}`,
    });

    for (const userId of subscribedUserIds) {
      const userSubs = subsByUser.get(userId)!;
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

    // Mark reminded so cron skips it on next run
    await prisma.reminderSent.upsert({
      where:  { appointmentId: appt.id },
      update: { sentAt: now },
      create: { appointmentId: appt.id },
    });
  }

  if (stale.length > 0) await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: stale } } });

  // Clean up reminder records older than 7 days
  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  await prisma.reminderSent.deleteMany({ where: { sentAt: { lt: cutoff } } });

  return NextResponse.json({ sent, appointments: toNotify.length, leadMinutes, staleCleaned: stale.length });
}
