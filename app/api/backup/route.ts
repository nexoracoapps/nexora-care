import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);
  if (payload.role !== 'ADMIN') return apiError('Forbidden', 403);

  const [appointments, customers, services, providers, branches, absences, callLogs] =
    await Promise.all([
      prisma.appointment.findMany({ include: { customer: true, service: true, serviceProvider: true } }),
      prisma.customer.findMany(),
      prisma.service.findMany(),
      prisma.serviceProvider.findMany(),
      prisma.branch.findMany(),
      prisma.staffAbsence.findMany(),
      prisma.callLog.findMany(),
    ]);

  const backup = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    data: { appointments, customers, services, providers, branches, absences, callLogs },
  };

  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="nexora-care-backup-${Date.now()}.json"`,
    },
  });
}

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);
  if (payload.role !== 'ADMIN') return apiError('Forbidden', 403);

  let body: any;
  try { body = await req.json(); }
  catch { return apiError('Invalid JSON', 400); }

  const data = body.data ?? body;
  const restored: Record<string, number> = {};

  try {
    // 1. Branches (no dependencies)
    for (const b of data.branches ?? []) {
      await prisma.branch.upsert({
        where: { id: b.id },
        update: { name: b.name, nameAr: b.nameAr ?? null, address: b.address ?? null, phone: b.phone ?? null },
        create: { id: b.id, name: b.name, nameAr: b.nameAr ?? null, address: b.address ?? null, phone: b.phone ?? null },
      });
    }
    restored.branches = (data.branches ?? []).length;

    // 2. Services (no dependencies)
    for (const s of data.services ?? []) {
      await prisma.service.upsert({
        where: { id: s.id },
        update: { name: s.name, nameAr: s.nameAr ?? null, price: s.price ?? 0, description: s.description ?? null },
        create: { id: s.id, name: s.name, nameAr: s.nameAr ?? null, price: s.price ?? 0, description: s.description ?? null },
      });
    }
    restored.services = (data.services ?? []).length;

    // 3. Providers (depends on branches)
    for (const p of data.providers ?? []) {
      await prisma.serviceProvider.upsert({
        where: { id: p.id },
        update: { name: p.name, type: p.type ?? 'THERAPIST', bio: p.bio ?? null, photoUrl: p.photoUrl ?? null, branchId: p.branchId ?? null },
        create: { id: p.id, name: p.name, type: p.type ?? 'THERAPIST', bio: p.bio ?? null, photoUrl: p.photoUrl ?? null, branchId: p.branchId ?? null },
      });
    }
    restored.providers = (data.providers ?? []).length;

    // 4. Customers (depends on branches)
    for (const c of data.customers ?? []) {
      await prisma.customer.upsert({
        where: { id: c.id },
        update: { name: c.name, phone: c.phone ?? null, email: c.email ?? null, branchId: c.branchId ?? null },
        create: { id: c.id, name: c.name, phone: c.phone ?? null, email: c.email ?? null, branchId: c.branchId ?? null },
      });
    }
    restored.customers = (data.customers ?? []).length;

    // 5. Appointments (depends on customers, services, providers, branches)
    for (const a of data.appointments ?? []) {
      const appt = {
        dateTime:          new Date(a.dateTime),
        status:            a.status            ?? 'SCHEDULED',
        serviceStatus:     a.serviceStatus     ?? 'PENDING',
        paymentStatus:     a.paymentStatus     ?? 'UNPAID',
        paymentMethod:     a.paymentMethod     ?? null,
        notes:             a.notes             ?? null,
        deliveryNotes:     a.deliveryNotes     ?? null,
        nextVisit:         a.nextVisit         ?? null,
        amount:            a.amount            ?? null,
        customerId:        a.customerId        ?? null,
        serviceId:         a.serviceId         ?? null,
        serviceProviderId: a.serviceProviderId ?? null,
        branchId:          a.branchId          ?? null,
      };
      await prisma.appointment.upsert({ where: { id: a.id }, update: appt, create: { id: a.id, ...appt } });
    }
    restored.appointments = (data.appointments ?? []).length;

    // 6. Staff absences (depends on providers)
    for (const ab of data.absences ?? []) {
      const absence = {
        providerId: ab.providerId ?? null,
        userId:     ab.userId     ?? null,
        startDate:  new Date(ab.startDate),
        endDate:    new Date(ab.endDate),
        reason:     ab.reason     ?? null,
      };
      await prisma.staffAbsence.upsert({ where: { id: ab.id }, update: absence, create: { id: ab.id, ...absence } });
    }
    restored.absences = (data.absences ?? []).length;

    // 7. Call logs (depends on customers)
    for (const cl of data.callLogs ?? []) {
      const log = {
        customerId:      cl.customerId      ?? null,
        customerName:    cl.customerName    ?? null,
        startedAt:       new Date(cl.startedAt),
        endedAt:         cl.endedAt ? new Date(cl.endedAt) : null,
        durationSeconds: cl.durationSeconds ?? null,
        status:          cl.status          ?? 'COMPLETED',
        notes:           cl.notes           ?? null,
      };
      await prisma.callLog.upsert({ where: { id: cl.id }, update: log, create: { id: cl.id, ...log } });
    }
    restored.callLogs = (data.callLogs ?? []).length;

    return NextResponse.json({ ok: true, restored });
  } catch (e: any) {
    console.error('Backup import error:', e);
    return NextResponse.json({ error: e.message ?? 'Import failed' }, { status: 500 });
  }
}
