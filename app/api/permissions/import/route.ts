import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { fillMissingKeys, SYSTEM_ROLE_META, SYSTEM_ROLES, type RolePermissions } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

interface ImportRole {
  name: string;
  label: string;
  labelAr?: string;
  color?: string;
  icon?: string;
  permissions: Partial<RolePermissions>;
  sortOrder?: number;
}

export async function POST(req: NextRequest) {
  try {
    const payload = await requireAuth(req);
    if (payload.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const roles: ImportRole[] = body.roles;
    if (!Array.isArray(roles) || roles.length === 0)
      return NextResponse.json({ error: 'Expected { roles: [...] }' }, { status: 400 });

    let upserted = 0;
    for (const r of roles) {
      if (!r.name || !r.label) continue;
      const slug = String(r.name).toUpperCase().replace(/[^A-Z0-9_]/g, '_');
      const isSystem = (SYSTEM_ROLES as readonly string[]).includes(slug);
      const meta = SYSTEM_ROLE_META[slug];

      await (prisma as any).roleDefinition.upsert({
        where: { name: slug },
        create: {
          name:        slug,
          label:       r.label,
          labelAr:     r.labelAr ?? '',
          color:       r.color  ?? meta?.color  ?? '#6366f1',
          icon:        r.icon   ?? meta?.icon   ?? '👤',
          isSystem,
          isAdmin:     meta?.isAdmin ?? false,
          permissions: JSON.stringify(fillMissingKeys(r.permissions ?? {})),
          sortOrder:   r.sortOrder ?? meta?.sortOrder ?? 100,
        },
        update: {
          label:       r.label,
          labelAr:     r.labelAr ?? '',
          color:       r.color  ?? meta?.color  ?? '#6366f1',
          icon:        r.icon   ?? meta?.icon   ?? '👤',
          permissions: JSON.stringify(fillMissingKeys(r.permissions ?? {})),
          ...(r.sortOrder !== undefined ? { sortOrder: r.sortOrder } : {}),
        },
      });
      upserted++;
    }

    return NextResponse.json({ ok: true, upserted });
  } catch (e: any) {
    if (e.message === 'Forbidden')    return NextResponse.json({ error: 'Forbidden' },    { status: 403 });
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
