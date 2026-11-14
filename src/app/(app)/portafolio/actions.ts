'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser, logAudit } from '@/lib/session';

export async function deletePortfolioEntryAction(formData: FormData) {
  const user = await requireUser();
  if (!['GERENCIA', 'DEV'].includes(user.role)) redirect('/portafolio?err=autoriza');

  const id = String(formData.get('id') || '');
  const entry = await prisma.portfolioEntry.findUnique({ where: { id } });
  if (!entry) redirect('/portafolio?err=noexiste');

  await prisma.portfolioEntry.delete({ where: { id } });
  await logAudit(user, 'Evidencia eliminada del portafolio', `${entry.clientName}${entry.otCode ? ` · ${entry.otCode}` : ''}`, 'portafolio');
  revalidatePath('/portafolio');
  redirect('/portafolio?msg=eliminada');
}
