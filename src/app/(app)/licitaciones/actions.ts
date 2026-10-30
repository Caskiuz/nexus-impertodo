'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser, logAudit } from '@/lib/session';
import { notify } from '@/lib/events';

export async function prefillTenderAction(formData: FormData) {
  const user = await requireUser();
  const tenderId = String(formData.get('tenderId') || '');
  const tender = await prisma.tender.findUnique({ where: { id: tenderId } });
  if (!tender) redirect('/licitaciones?err=noexiste');

  await prisma.tender.update({ where: { id: tender.id }, data: { status: 'PRELLENADA' } });
  await notify('Expediente pre-llenado', `${tender.convener} · ${tender.object}. Requisitos técnicos y administrativos preparados (demo).`, 'SYSTEM');
  await logAudit(user, 'Expediente de licitación pre-llenado', tender.convener);
  revalidatePath('/licitaciones');
  redirect('/licitaciones?msg=prellenado');
}
