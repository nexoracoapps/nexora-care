import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const DEFAULT_LEAD_MINUTES = 60;
const CRON_WINDOW_MINUTES  = 35; // half-window around the lead time to catch each appointment once

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const isTest = searchParams.get('test') === 'true';

  // Auth: either Vercel cron secret OR a logged-in ADMIN user
  const authHeader     = req.headers.get('authorization');
  const isCron         = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const callerPayload  = getTokenFromRequest(req);

  if (!isCron) {
    if (!callerPayload || callerPayload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
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

  // Read configurable lead time from SystemSetting
  const setting = await prisma.systemSetting.findUnique({ where: { key: 'reminderLeadMinutes' } });
  const leadMin = parseInt(setting?.value ?? String(DEFAULT_LEAD_MINUTES), 10) || DEFAULT_LEAD_MINUTES;

  const now       = new Date();
  const windowStart = new Date(now.getTime() + (leadMin - CRON_WINDOW_MINUTES) * 60 * 1000);
  const windowEnd   = new Date(now.getTime() + (leadMin + CRON_WINDOW_MINUTES) * 60 * 1000);

  const upcoming = await prisma.appointment.findMany({
    where: { status: 'SCHEDULED', dateTime: { gte: windowStart, lte: windowEnd } },
    include: { customer: true, service: true },
  });

  if (upcoming.length === 0) {
    return NextResponse.json({ sent: 0, leadMin, message: 'No appointments in reminder window' });
  }

  // Skip appointments already notified
  const alreadySent = await prisma.reminderSent.findMany({
    where: { appointmentId: { in: upcoming.map(a => a.id) } },
    select: { appointmentId: true },
  });
  const sentIds = new Set(alreadySent.map(r => r.appointmentId));
  const toNotify = upcoming.filter(a => !sentIds.has(a.id));

  if (toNotify.length === 0) {
    return NextResponse.json({ sent: 0, leadMin, message: 'All appointments already notified' });
  }

  // Fetch push subscriptions grouped by user
  const allSubs    = await prisma.pushSubscription.findMany();
  const subsByUser = new Map<string, typeof allSubs>();
  for (const sub of allSubs) {
    if (!subsByUser.has(sub.userId)) subsByUser.set(sub.userId, []);
    subsByUser.get(sub.userId)!.push(sub);
  }

  const users = await prisma.user.findMany({
    select: { id: true, role: true, providerId: true },
  });

  let sent = 0;
  const stale: string[] = [];

  for (const appt of toNotify) {
    const dt      = new Date(appt.dateTime);
    const timeStr = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const dateStr = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const minutesAway = Math.round((dt.getTime() - now.getTime()) / 60000);
    const payload = JSON.stringify({
      title: `📅 Appointment in ${minutesAway} min`,
      body:  `${appt.customer?.name ?? 'Customer'} — ${appt.service?.name ?? 'Service'} at ${timeStr} on ${dateStr}`,
      url:   '/appointments',
      tag:   `appt-${appt.id}`,
    });

    for (const user of users) {
      const userSubs = subsByUser.get(user.id);
      if (!userSubs || userSubs.length === 0) continue;

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

    // Mark this appointment as reminded so subsequent cron runs skip it
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

  return NextResponse.json({ sent, leadMin, appointments: toNotify.length, staleCleaned: stale.length });
}
