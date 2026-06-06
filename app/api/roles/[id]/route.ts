import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { fillMissingKeys, type RolePermissions } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

function parseRole(r: any) {
  let permissions: RolePermissions;
  try { permissions = fillMissingKeys(JSON.parse(r.permissions)); }
  catch { permissions = fillMissingKeys({}); }
  return { ...r, permissions };
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await requireAuth(req);
    if (payload.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const role = await (prisma as any).roleDefinition.findUnique({ where: { id: params.id } });
    if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json();
    const data: Record<string, any> = {};

    if (body.label    !== undefined) data.label    = body.label;
    if (body.labelAr  !== undefined) data.labelAr  = body.labelAr;
    if (body.color    !== undefined) data.color    = body.color;
    if (body.icon     !== undefined) data.icon     = body.icon;
    if (body.permissions !== undefined)
      data.permissions = JSON.stringify(fillMissingKeys(body.permissions));

    const updated = await (prisma as any).roleDefinition.update({ where: { id: params.id }, data });
    return NextResponse.json(parseRole(updated));
  } catch (e: any) {
    if (e.message === 'Forbidden')    return NextResponse.json({ error: 'Forbidden' },    { status: 403 });
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await requireAuth(req);
    if (payload.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const role = await (prisma as any).roleDefinition.findUnique({ where: { id: params.id } });
    if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (role.isAdmin) return NextResponse.json({ error: 'Cannot delete the Admin role' }, { status: 400 });

    // Check if any users are still assigned this role
    const userCount = await (prisma as any).user.count({ where: { role: role.name } });
    if (userCount > 0)
      return NextResponse.json({ error: `${userCount} user(s) still have this role. Reassign them first.` }, { status: 400 });

    await (prisma as any).roleDefinition.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.message === 'Forbidden')    return NextResponse.json({ error: 'Forbidden' },    { status: 403 });
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
