import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function exportDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  const [branches, users, customers, services, serviceProviders, appointments, callLogs, auditLogs] =
    await Promise.all([
      prisma.branch.findMany(),
      prisma.user.findMany({ select: { id: true, username: true, email: true, phone: true, role: true, branchId: true, createdAt: true } }),
      prisma.customer.findMany(),
      prisma.service.findMany(),
      prisma.serviceProvider.findMany(),
      prisma.appointment.findMany({ include: { customer: true, service: true, serviceProvider: true } }),
      prisma.callLog.findMany(),
      prisma.auditLog.findMany(),
    ]);

  const backup = { exportedAt: new Date().toISOString(), branches, users, customers, services, serviceProviders, appointments, callLogs, auditLogs };

  const outDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  const outPath = path.join(outDir, `backup-${timestamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(backup, null, 2), 'utf-8');
  console.log(`✅ Backup saved to: ${outPath}`);
  console.log(`   Branches: ${branches.length}, Users: ${users.length}, Customers: ${customers.length}`);
  console.log(`   Appointments: ${appointments.length}, Services: ${services.length}`);

  await prisma.$disconnect();
}

exportDatabase().catch(console.error);
