'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser, logAudit } from '@/lib/session';

export async function remindInvoiceAction(formData: FormData) {
  const user = await requireUser();
  const invoiceId = String(formData.get('invoiceId') || '');
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv) redirect('/cobrar?err=noexiste');

  await prisma.notification.create({
    data: {
      title: `Recordatorio de cobro · ${inv.clientName}`,
      body: `${inv.folio} por $${inv.amount.toLocaleString('es-MX')}. Envío real por WhatsApp se activa en fase 2; registra el recordatorio en el expediente.`,
      kind: 'SYSTEM'
    }
  });
  await logAudit(user, 'Recordatorio de cobro registrado', `${inv.folio} · ${inv.clientName}`);
  revalidatePath('/cobrar');
  redirect('/cobrar?msg=recordatorio');
}

export async function payInvoiceAction(formData: FormData) {
  const user = await requireUser();
  const invoiceId = String(formData.get('invoiceId') || '');
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv) redirect('/cobrar?err=noexiste');
  await prisma.invoice.update({ where: { id: inv.id }, data: { status: 'PAGADA' } });
  await logAudit(user, 'Factura marcada como pagada (manual)', inv.folio);
  revalidatePath('/cobrar');
  revalidatePath('/hoy');
  redirect('/cobrar?msg=pagada');
}

export async function addCollectionNoteAction(formData: FormData) {
  const user = await requireUser();
  const clientName = String(formData.get('clientName') || '').trim();
  const note = String(formData.get('note') || '').trim();
  if (!clientName || !note) redirect(`/cobrar?client=${encodeURIComponent(clientName)}&err=nota`);

  await prisma.collectionNote.create({
    data: { clientName, note, userName: user.name || null }
  });
  await logAudit(user, 'Nota de gestión de cobro', `${clientName} · ${note.slice(0, 80)}`);
  revalidatePath('/cobrar');
  redirect(`/cobrar?client=${encodeURIComponent(clientName)}&msg=nota`);
}
