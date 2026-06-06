# Nexora Care — Claude Context

## Project Overview
Nexora Care is a clinic & wellness management SaaS platform built with Next.js 14 (App Router), Prisma ORM, PostgreSQL (Neon), and JWT auth. It supports multi-branch operations, role-based access, push notifications, offline-first PWA, and WhatsApp/Twilio integrations.

## Dev Server
```
npm run dev   # runs on port 6001
```

## Key Architecture

### Auth
- JWT stored in `localStorage` or `sessionStorage` (remember-me toggle)
- `AuthContext` → `PermissionsContext` → `ProtectedRoute` chain
- Roles: `ADMIN`, `MANAGER`, `STAFF` (system) + custom roles
- `canDo(permKey)` is the single permission gate — ADMIN bypasses all checks

### Permissions System
- Stored per-role in `roleDefinition.permissions` (JSON column)
- Default values in `lib/permissions.ts → DEFAULT_PERMISSIONS`
- `ensureSeeded()` in `app/api/permissions/route.ts` handles first-time seeding AND a one-time migration (`permissions_migration_v2`) that repairs keys added after initial DB seeding
- **Hard rule**: `roles` prop on `ProtectedRoute` and Navbar `navItems` is always checked FIRST before `permKey/permKeys`

### Navigation Guard Pattern
```
Navbar visibleItems:
  if (!item.roles.includes(user.role)) return false   // roles = hard gate
  if (item.permKeys) return permKeys.some(k => canDo(k))
  if (item.permKey)  return canDo(item.permKey)
  return true

ProtectedRoute checkAccess:
  roleAllowed = roles ? roles.includes(user.role) : (!adminOnly || isAdmin)
  if (!roleAllowed) return false
  if (permKeys)  return permKeys.some(k => canDo(k))
  if (permKey)   return canDo(permKey)
  return true
```

### PWA / Service Worker
- `public/sw.js` — current version: **v8**
- `components/PushRegistrar.tsx` — registers push + warms shell cache
- Cache names: `nexora-shell-v8`, `nexora-api-v8`, `nexora-static-v8`
- **To force cache wipe on all clients**: bump all three version strings to v9 (or next)

### Push Notifications
- VAPID keys in Vercel env vars
- `lib/push.ts` — sends to ADMIN+MANAGER + assigned provider
- `app/api/cron/reminders/route.ts` — manual trigger or Vercel cron
- Test endpoint: `GET /api/cron/reminders?test=true` (logged-in user only)
- Notification icon: `/icon-192.png` (NOT `/icons/icon-192.png`)

### Branch Context
- `BranchContext` seeds from `nexora-branches-cache` in localStorage to prevent sidebar flash on navigation
- STAFF role is locked to their assigned branch; ADMIN/MANAGER can switch

### Offline
- `lib/offlineQueue.ts` — IndexedDB queue for failed mutations
- `lib/queuedFetch.ts` — wraps fetch; enqueues on NetworkError
- `hooks/useOfflineSync.ts` — syncs queue on reconnect
- `components/OfflineBanner.tsx` — shows when offline OR pending > 0

## Role → Page Matrix

| Page           | Roles         | permKey/permKeys                        |
|----------------|---------------|-----------------------------------------|
| /dashboard     | ADMIN,MANAGER | dashboard                               |
| /customers     | ALL           | manageCustomers                         |
| /appointments  | ALL           | manageAppointments                      |
| /prescriptions | ALL           | viewPrescriptions                       |
| /calendar      | ALL           | viewCalendar OR manageAppointments      |
| /medicines     | ADMIN,MANAGER | manageMedicines                         |
| /services      | ADMIN,MANAGER | manageServices                          |
| /providers     | ALL           | manageProviders OR manageServices       |
| /users         | ADMIN         | viewUsers                               |
| /roles         | ADMIN         | viewRoles OR managePermissions          |
| /branches      | ADMIN,MANAGER | manageBranches                          |
| /revenue       | ADMIN,MANAGER | viewRevenue OR viewReports              |
| /payments      | ADMIN,MANAGER | recordPayments                          |
| /reports       | ADMIN,MANAGER | viewReports                             |
| /staff-absence | ALL           | manageStaffAbsence                      |
| /permissions   | ADMIN         | managePermissions                       |
| /backup        | ADMIN (only)  | systemBackup                            |

## Common Pitfalls
- `transition: all` on sidebar items causes layout jumps — always use specific properties
- `BranchContext.branches` starts from localStorage cache — never from empty array
- `fillMissingKeys` uses `false` as fallback, NOT DEFAULT_PERMISSIONS — migration v2 repairs this
- SW version must be bumped when making static asset changes users need immediately
- Push notification icon path is `/icon-192.png`, NOT `/icons/icon-192.png`
- `ProtectedRoute` with only `permKey` (no `roles`) allows ALL authenticated roles — add `roles` explicitly for PRIV/ADMIN pages

## Local Dev Notes
- Port: 6001
- DB: Neon PostgreSQL (connection string in `.env`)
- Do not use SQLite — schema is PostgreSQL-only
- Run `npx prisma generate` after schema changes
- `.env` is gitignored and must be present locally
