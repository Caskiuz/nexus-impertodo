'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { notify } from '@/lib/events';
import { fmt } from '@/lib/constants';

export async function chooseOptionAction(formData: FormData) {
  const folio = String(formData.get('folio') || '');
  const choice = String(formData.get('choice') || 'B') === 'A' ? 'A' : 'B';
  const quote = await prisma.quote.findFirst({ where: { folio } });
  if (!quote) return;
  await prisma.quote.update({ where: { id: quote.id }, data: { selected: choice } });
  await prisma.quoteEvent.create({ data: { quoteId: quote.id, type: 'CHOICE', detail: `Cliente eligió la opción ${choice}` } });
  revalidatePath(`/p/${folio}`);
  revalidatePath('/propuesta');
  redirect(`/p/${folio}?msg=elegida`);
}

export async function approveProposalAction(formData: FormData) {
  const folio = String(formData.get('folio') || '');
  const quote = await prisma.quote.findFirst({ where: { folio } });
  if (!quote) return;

  await prisma.quoteEvent.create({
    data: { quoteId: quote.id, type: 'APPROVED', detail: 'Cliente aprobó la propuesta desde el enlace público' }
  });

  const lead = await prisma.lead.findFirst({ where: { unitId: quote.unitId, company: quote.clientName } });
  if (lead && lead.stage < 3) {
    await prisma.lead.update({ where: { id: lead.id }, data: { stage: 3, nextAction: 'Anticipo por confirmar' } });
  }

  const sys = await prisma.system.findUnique({ where: { key: quote.selected === 'A' ? quote.optA : quote.optB } });
  await notify(
    'Propuesta aprobada por el cliente',
    `${quote.clientName} aprobó ${quote.folio} por ${fmt(quote.total)}. Solicitar anticipo ${sys?.pago || ''}. No hay cobro automático: se registra manualmente.`,
    'SYSTEM'
  );

  revalidatePath(`/p/${folio}`);
  revalidatePath('/propuesta');
  revalidatePath('/hoy');
  redirect(`/p/${folio}?msg=aprobada`);
}
