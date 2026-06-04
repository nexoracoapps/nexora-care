'server-only';

import { prisma } from './prisma';

type PushAppt = {
  id: string;
  dateTime: Date | string;
  serviceProviderId?: string | null;
  customer?: { name?: string | null } | null;
  service?: { name?: string | null } | null;
};

type ApptAction = 'created' | 'updated' | 'rescheduled' | 'cancelled' | 'completed' | 'no-show';

const ICONS: Record<ApptAction, string> = {
  created:     '📅',
  updated:     '✏️',
  rescheduled: '🔄',
  cancelled:   '❌',
  completed:   '✅',
  'no-show':   '⚠️',
};

const LABELS: Record<ApptAction, string> = {
  created:     'New Appointment',
  updated:     'Appointment Updated',
  rescheduled: 'Appointment Rescheduled',
  cancelled:   'Appointment Cancelled',
  completed:   'Appointment Completed',
  'no-show':   'No Show',
};

export async function notifyAppointment(appt: PushAppt, action: ApptAction) {
  const vapidPublic  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY ?? '';
  const vapidSubject = process.env.VAPID_SUBJECT ?? 'mailto:noreply@nexoracare.com';
  if (!vapidPublic || !vapidPrivate) return; // VAPID not configured — skip silently

  try {
    const webpush = (await import('web-push')).default;
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const dt      = new Date(appt.dateTime);
    const timeStr = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const dateStr = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const payload = JSON.stringify({
      title: `${ICONS[action]} ${LABELS[action]}`,
      body:  `${appt.customer?.name ?? 'Customer'} · ${appt.service?.name ?? 'Service'} — ${dateStr} at ${timeStr}`,
      url:   '/calendar',
      tag:   `appt-${appt.id}`,
    });

    // Notify: all ADMIN + MANAGER users, plus the assigned provider's linked user
    const recipients = await prisma.user.findMany({
      where: {
        OR: [
          { role: { in: ['ADMIN', 'MANAGER'] } },
          ...(appt.serviceProviderId ? [{ providerId: appt.serviceProviderId }] : []),
        ],
      },
      select: { id: true },
    });

    const subs = await prisma.pushSubscription.findMany({
      where: { userId: { in: recipients.map(u => u.id) } },
    });

    const stale: string[] = [];
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
      } catch (err: unknown) {
        if ((err as { statusCode?: number }).statusCode === 410) stale.push(sub.endpoint);
      }
    }
    if (stale.length > 0) {
      await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: stale } } });
    }
  } catch {
    // Push is optional — never throw and block the main response
  }
}
