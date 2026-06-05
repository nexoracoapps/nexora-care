import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/utils';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);
  if (!['ADMIN','MANAGER'].includes(payload.role)) return apiError('Forbidden', 403);

  const { name, nameAr, address, phone } = await req.json();

  const branch = await prisma.branch.update({
    where: { id: params.id },
    data: {
      ...(name && { name }),
      ...(nameAr !== undefined && { nameAr: nameAr || null }),
      ...(address !== undefined && { address }),
      ...(phone !== undefined && { phone }),
    },
  });

  return apiOk(branch);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return apiError('Unauthorized', 401);
  if (!['ADMIN'].includes(payload.role)) return apiError('Forbidden — only ADMIN can delete branches', 403);

  const branch = await prisma.branch.findUnique({ where: { id: params.id }, select: { name: true } });
  if (!branch) return apiError('Branch not found.', 404);

  try {
    await prisma.$transaction(async (tx) => {
      // Unassign users from this branch
      await tx.user.updateMany({ where: { branchId: params.id }, data: { branchId: null } });
      // Unassign customers from this branch
      await tx.customer.updateMany({ where: { branchId: params.id }, data: { branchId: null } });
      // Nullify branch on appointments
      await tx.appointment.updateMany({ where: { branchId: params.id }, data: { branchId: null } });
      // Unassign providers from this branch
      await tx.serviceProvider.updateMany({ where: { branchId: params.id }, data: { branchId: null } });
      // Delete the branch
      await tx.branch.delete({ where: { id: params.id } });
    });
    return apiOk({ message: `Branch "${branch.name}" deleted. Users, customers, and appointments unassigned.` });
  } catch (e: unknown) {
    console.error('Branch delete failed:', e);
    return apiError('Failed to delete branch.', 500);
  }
}
