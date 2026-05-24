import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest, requireAuth } from '@/lib/auth';
import { ALL_PERMISSION_KEYS, fillMissingKeys, SYSTEM_ROLES, SYSTEM_ROLE_META, DEFAULT_PERMISSIONS, type AllPermissions, type RolePermissions } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

// Re-export for backward compat with any pages importing types from this route
export type { AllPermissions, RolePermissions };

async function ensureSeeded() {
  const count = await (prisma as any).roleDefinition.count();
  if (count > 0) return;

  let migrated: Record<string, Partial<RolePermissions>> = {};
  try {
    const setting = await (prisma as any).systemSetting.findUnique({ where: { key: 'permissions' } });
    if (setting) migrated = JSON.parse(setting.value);
  } catch {}

  await (prisma as any).roleDefinition.createMany({
    data: SYSTEM_ROLES.map(name => {
      const meta = SYSTEM_ROLE_META[name];
      return {
        name,
        label:       meta.label,
        labelAr:     meta.labelAr,
        color:       meta.color,
        icon:        meta.icon,
        isSystem:    true,
        isAdmin:     meta.isAdmin,
        permissions: JSON.stringify(fillMissingKeys({ ...DEFAULT_PERMISSIONS[name], ...(migrated[name] ?? {}) })),
        sortOrder:   meta.sortOrder,
      };
    }),
  });
}

async function getAllPermissions(): Promise<AllPermissions> {
  const roles = await (prisma as any).roleDefinition.findMany({ orderBy: { sortOrder: 'asc' } });
  const result: AllPermissions = {};
  for (const r of roles) {
    let stored: Partial<Record<string, boolean>> = {};
    try { stored = JSON.parse(r.permissions); } catch {}
    result[r.name] = Object.fromEntries(
      ALL_PERMISSION_KEYS.map(k => [k, stored[k] ?? false])
    ) as RolePermissions;
  }
  return result;
}

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await ensureSeeded();
    return NextResponse.json(await getAllPermissions());
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const payload = requireAuth(req);
    if (!['ADMIN', 'MANAGER'].includes(payload.role)) throw new Error('Forbidden');

    const body: AllPermissions = await req.json();

    for (const [roleName, perms] of Object.entries(body)) {
      const role = await (prisma as any).roleDefinition.findUnique({ where: { name: roleName } });
      if (!role) continue;
      // MANAGER may only touch STAFF or non-system roles
      if (payload.role === 'MANAGER' && role.isSystem && roleName !== 'STAFF') continue;
      await (prisma as any).roleDefinition.update({
        where: { name: roleName },
        data: { permissions: JSON.stringify(fillMissingKeys(perms)) },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.message === 'Forbidden')    return NextResponse.json({ error: 'Forbidden' },    { status: 403 });
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
