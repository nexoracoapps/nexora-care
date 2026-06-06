import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest, requireAuth } from '@/lib/auth';
import {
  DEFAULT_PERMISSIONS, SYSTEM_ROLES, SYSTEM_ROLE_META,
  fillMissingKeys, type RolePermissions,
} from '@/lib/permissions';

export const dynamic = 'force-dynamic';

// Auto-seed system roles on first use, migrating any existing SystemSetting delta
async function ensureSeeded() {
  const count = await (prisma as any).roleDefinition.count();
  if (count > 0) return;

  // Try to migrate existing stored delta from the old SystemSetting approach
  let migrated: Record<string, Partial<RolePermissions>> = {};
  try {
    const setting = await (prisma as any).systemSetting.findUnique({ where: { key: 'permissions' } });
    if (setting) migrated = JSON.parse(setting.value);
  } catch {}

  await (prisma as any).roleDefinition.createMany({
    data: SYSTEM_ROLES.map(name => {
      const meta = SYSTEM_ROLE_META[name];
      const base = DEFAULT_PERMISSIONS[name];
      const delta = migrated[name] ?? {};
      return {
        name,
        label:       meta.label,
        labelAr:     meta.labelAr,
        color:       meta.color,
        icon:        meta.icon,
        isSystem:    true,
        isAdmin:     meta.isAdmin,
        permissions: JSON.stringify(fillMissingKeys({ ...base, ...delta })),
        sortOrder:   meta.sortOrder,
      };
    }),
  });
}

function parseRole(r: any) {
  let permissions: RolePermissions;
  try { permissions = fillMissingKeys(JSON.parse(r.permissions)); }
  catch { permissions = fillMissingKeys(DEFAULT_PERMISSIONS[r.name] ?? {}); }
  return { ...r, permissions };
}

export async function GET(req: NextRequest) {
  const payload = await getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await ensureSeeded();
    const roles = await (prisma as any).roleDefinition.findMany({ orderBy: { sortOrder: 'asc' } });
    return NextResponse.json(roles.map(parseRole));
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await requireAuth(req);
    if (payload.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { name, label, labelAr, color, icon, copyFromRole } = await req.json();
    if (!name || !label) return NextResponse.json({ error: 'name and label are required' }, { status: 400 });

    const slug = String(name).toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if ((SYSTEM_ROLES as readonly string[]).includes(slug))
      return NextResponse.json({ error: 'Cannot use a system role name' }, { status: 400 });

    const existing = await (prisma as any).roleDefinition.findUnique({ where: { name: slug } });
    if (existing) return NextResponse.json({ error: 'Role name already exists' }, { status: 409 });

    // Copy permissions from source role
    let permissions: Partial<RolePermissions> = DEFAULT_PERMISSIONS.STAFF;
    if (copyFromRole) {
      const src = await (prisma as any).roleDefinition.findUnique({ where: { name: copyFromRole } });
      if (src) { try { permissions = JSON.parse(src.permissions); } catch {} }
    }

    const maxSort = await (prisma as any).roleDefinition.findFirst({ orderBy: { sortOrder: 'desc' } });

    const role = await (prisma as any).roleDefinition.create({
      data: {
        name: slug,
        label,
        labelAr: labelAr ?? '',
        color:   color  ?? '#6366f1',
        icon:    icon   ?? '👤',
        isSystem: false,
        isAdmin:  false,
        permissions: JSON.stringify(fillMissingKeys(permissions)),
        sortOrder: (maxSort?.sortOrder ?? 100) + 10,
      },
    });
    return NextResponse.json(parseRole(role), { status: 201 });
  } catch (e: any) {
    if (e.message === 'Forbidden')    return NextResponse.json({ error: 'Forbidden' },    { status: 403 });
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
