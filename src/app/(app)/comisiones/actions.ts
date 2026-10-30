'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser, logAudit } from '@/lib/session';

function isDev(role: string) {
  return role === 'DEV';
}

export async function markCommissionCollectedAction(formData: FormData) {
  const user = await requireUser();
  if (!isDev(user.role)) redirect('/comisiones?err=rol');
  const id = String(formData.get('entryId') || '');
  const entry = await prisma.commissionEntry.findUnique({ where: { id } });
  if (!entry) redirect('/comisiones?err=noexiste');

  await prisma.commissionEntry.update({
    where: { id: entry.id },
    data: { status: 'COBRADA', collectedAt: new Date() }
  });
  await logAudit(user, 'Comisión marcada como cobrada', `${entry.id} · $${entry.amount}`);
  revalidatePath('/comisiones');
  redirect('/comisiones?msg=cobrada');
}

export async function updateCommissionRateAction(formData: FormData) {
  const user = await requireUser();
  if (!isDev(user.role)) redirect('/comisiones?err=rol');
  const pct = parseFloat(String(formData.get('rate') || '20')) || 20;
  const rate = Math.min(50, Math.max(1, pct)) / 100;

  await prisma.commissionConfig.upsert({
    where: { id: 'default' },
    create: { id: 'default', rate },
    update: { rate }
  });
  await logAudit(user, 'Tasa de comisión actualizada', `${(rate * 100).toFixed(0)}%`);
  revalidatePath('/comisiones');
  redirect('/comisiones?msg=tasa');
}
