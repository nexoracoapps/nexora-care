import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { DEFAULT_PERMISSIONS, SYSTEM_ROLES, SYSTEM_ROLE_META, fillMissingKeys } from '../lib/permissions';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding NexoraCare database...');

  // Create branches
  const branch1 = await prisma.branch.upsert({
    where: { id: 'branch-1' },
    update: {},
    create: {
      id: 'branch-1',
      name: 'Downtown Wellness Center',
      address: '123 Main Street, Downtown',
      phone: '+1 (555) 100-0001',
    },
  });

  const branch2 = await prisma.branch.upsert({
    where: { id: 'branch-2' },
    update: {},
    create: {
      id: 'branch-2',
      name: 'Uptown Beauty Clinic',
      address: '456 Park Avenue, Uptown',
      phone: '+1 (555) 100-0002',
    },
  });

  console.log('✅ Branches created');

  // Create users
  const adminPw = await bcrypt.hash('admin123', 10);
  const staffPw = await bcrypt.hash('staff123', 10);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: adminPw,
      email: 'admin@nexoracare.com',
      role: 'ADMIN',
      branchId: branch1.id,
    },
  });

  await prisma.user.upsert({
    where: { username: 'staff1' },
    update: {},
    create: {
      username: 'staff1',
      password: staffPw,
      email: 'staff1@nexoracare.com',
      role: 'STAFF',
      branchId: branch1.id,
    },
  });

  await prisma.user.upsert({
    where: { username: 'staff2' },
    update: {},
    create: {
      username: 'staff2',
      password: staffPw,
      email: 'staff2@nexoracare.com',
      role: 'STAFF',
      branchId: branch2.id,
    },
  });

  console.log('✅ Users created');

  // Create services
  const services = await Promise.all([
    prisma.service.upsert({ where: { id: 'svc-1' }, update: {}, create: { id: 'svc-1', name: 'Swedish Massage', price: 85, description: 'Full-body relaxation massage' } }),
    prisma.service.upsert({ where: { id: 'svc-2' }, update: {}, create: { id: 'svc-2', name: 'Deep Tissue Massage', price: 110, description: 'Therapeutic deep muscle therapy' } }),
    prisma.service.upsert({ where: { id: 'svc-3' }, update: {}, create: { id: 'svc-3', name: 'Facial Treatment', price: 75, description: 'Hydrating and rejuvenating facial' } }),
    prisma.service.upsert({ where: { id: 'svc-4' }, update: {}, create: { id: 'svc-4', name: 'Hair Cut & Style', price: 55, description: 'Professional haircut and styling' } }),
    prisma.service.upsert({ where: { id: 'svc-5' }, update: {}, create: { id: 'svc-5', name: 'Nail Manicure', price: 40, description: 'Classic nail care and polish' } }),
    prisma.service.upsert({ where: { id: 'svc-6' }, update: {}, create: { id: 'svc-6', name: 'Hot Stone Therapy', price: 120, description: 'Heated volcanic stone massage therapy' } }),
  ]);

  console.log('✅ Services created');

  // Create providers
  const providers = await Promise.all([
    prisma.serviceProvider.upsert({ where: { id: 'prov-1' }, update: {}, create: { id: 'prov-1', name: 'Dr. Sarah Chen', type: 'THERAPIST', bio: 'Certified massage therapist with 8 years experience', branchId: branch1.id } }),
    prisma.serviceProvider.upsert({ where: { id: 'prov-2' }, update: {}, create: { id: 'prov-2', name: 'Emma Rodriguez', type: 'ESTHETICIAN', bio: 'Expert in facial treatments and skin care', branchId: branch1.id } }),
    prisma.serviceProvider.upsert({ where: { id: 'prov-3' }, update: {}, create: { id: 'prov-3', name: 'James Wilson', type: 'STYLIST', bio: 'Master hairstylist with salon experience', branchId: branch1.id } }),
    prisma.serviceProvider.upsert({ where: { id: 'prov-4' }, update: {}, create: { id: 'prov-4', name: 'Dr. Aisha Patel', type: 'DOCTOR', bio: 'Licensed physician specializing in aesthetic medicine', branchId: branch2.id } }),
    prisma.serviceProvider.upsert({ where: { id: 'prov-5' }, update: {}, create: { id: 'prov-5', name: 'Lisa Kim', type: 'NAIL_ARTIST', bio: 'Creative nail artist and nail health specialist', branchId: branch2.id } }),
  ]);

  console.log('✅ Providers created');

  // Create customers
  const customers = await Promise.all([
    prisma.customer.upsert({ where: { id: 'cust-1' }, update: {}, create: { id: 'cust-1', name: 'Alice Johnson', phone: '+1 (555) 200-0001', email: 'alice@email.com', branchId: branch1.id } }),
    prisma.customer.upsert({ where: { id: 'cust-2' }, update: {}, create: { id: 'cust-2', name: 'Bob Martinez', phone: '+1 (555) 200-0002', email: 'bob@email.com', branchId: branch1.id } }),
    prisma.customer.upsert({ where: { id: 'cust-3' }, update: {}, create: { id: 'cust-3', name: 'Carol Davis', phone: '+1 (555) 200-0003', email: 'carol@email.com', branchId: branch1.id } }),
    prisma.customer.upsert({ where: { id: 'cust-4' }, update: {}, create: { id: 'cust-4', name: 'David Thompson', phone: '+1 (555) 200-0004', email: 'david@email.com', branchId: branch2.id } }),
    prisma.customer.upsert({ where: { id: 'cust-5' }, update: {}, create: { id: 'cust-5', name: 'Eva Williams', phone: '+1 (555) 200-0005', email: 'eva@email.com', branchId: branch2.id } }),
    prisma.customer.upsert({ where: { id: 'cust-6' }, update: {}, create: { id: 'cust-6', name: 'Frank Brown', phone: '+1 (555) 200-0006', email: 'frank@email.com', branchId: branch1.id } }),
  ]);

  console.log('✅ Customers created');

  // Create appointments
  const now = new Date();
  const apptData = [
    { id: 'appt-1', daysOffset: 0, hour: 10, cust: 0, svc: 0, prov: 0, status: 'SCHEDULED' as const, payment: 'UNPAID' as const, amount: 85 },
    { id: 'appt-2', daysOffset: 0, hour: 14, cust: 1, svc: 2, prov: 1, status: 'SCHEDULED' as const, payment: 'UNPAID' as const, amount: 75 },
    { id: 'appt-3', daysOffset: -1, hour: 11, cust: 2, svc: 1, prov: 0, status: 'COMPLETED' as const, payment: 'PAID' as const, amount: 110 },
    { id: 'appt-4', daysOffset: -1, hour: 15, cust: 3, svc: 3, prov: 2, status: 'COMPLETED' as const, payment: 'PAID' as const, amount: 55 },
    { id: 'appt-5', daysOffset: -2, hour: 9, cust: 4, svc: 4, prov: 4, status: 'COMPLETED' as const, payment: 'UNPAID' as const, amount: 40 },
    { id: 'appt-6', daysOffset: -3, hour: 13, cust: 0, svc: 5, prov: 0, status: 'CANCELLED' as const, payment: 'UNPAID' as const, amount: 120 },
    { id: 'appt-7', daysOffset: 1, hour: 11, cust: 1, svc: 0, prov: 0, status: 'SCHEDULED' as const, payment: 'UNPAID' as const, amount: 85 },
    { id: 'appt-8', daysOffset: 2, hour: 16, cust: 5, svc: 2, prov: 1, status: 'SCHEDULED' as const, payment: 'UNPAID' as const, amount: 75 },
    { id: 'appt-9', daysOffset: -4, hour: 10, cust: 2, svc: 3, prov: 2, status: 'NO_SHOW' as const, payment: 'UNPAID' as const, amount: 55 },
    { id: 'appt-10', daysOffset: -5, hour: 14, cust: 3, svc: 1, prov: 0, status: 'COMPLETED' as const, payment: 'PAID' as const, amount: 110 },
  ];

  await Promise.all(apptData.map(a => {
    const dt = new Date(now);
    dt.setDate(dt.getDate() + a.daysOffset);
    dt.setHours(a.hour, 0, 0, 0);
    return prisma.appointment.upsert({
      where: { id: a.id },
      update: {},
      create: {
        id: a.id,
        dateTime: dt,
        customerId: customers[a.cust].id,
        serviceId: services[a.svc].id,
        serviceProviderId: providers[a.prov].id,
        branchId: customers[a.cust].branchId,
        status: a.status,
        paymentStatus: a.payment,
        paymentMethod: a.payment === 'PAID' ? 'CASH' : null,
        amount: a.amount,
        serviceStatus: a.status === 'COMPLETED' ? 'DELIVERED' : 'PENDING',
      },
    });
  }));

  console.log('✅ Appointments created');
  // Seed role definitions
  for (const name of SYSTEM_ROLES) {
    const meta = SYSTEM_ROLE_META[name];
    await (prisma as any).roleDefinition.upsert({
      where: { name },
      update: {},
      create: {
        name,
        label:       meta.label,
        labelAr:     meta.labelAr,
        color:       meta.color,
        icon:        meta.icon,
        isSystem:    true,
        isAdmin:     meta.isAdmin,
        permissions: JSON.stringify(fillMissingKeys(DEFAULT_PERMISSIONS[name])),
        sortOrder:   meta.sortOrder,
      },
    });
  }
  console.log('✅ Role definitions seeded');

  console.log('\n🎉 Seed complete!');
  console.log('\n👤 Login credentials:');
  console.log('   Admin:  username=admin    password=admin123');
  console.log('   Staff:  username=staff1   password=staff123');
  console.log('   Staff:  username=staff2   password=staff123');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
