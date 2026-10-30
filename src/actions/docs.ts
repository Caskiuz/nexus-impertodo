'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser, getActiveUnitId, logAudit } from '@/lib/session';
import { recordBusinessEvent } from '@/lib/events';

export async function reviewDocAction(formData: FormData) {
  const user = await requireUser();
  const docId = String(formData.get('docId') || '');
  const redirectTo = String(formData.get('redirectTo') || '/aprobaciones');
  const doc = await prisma.doc.findUnique({ where: { id: docId } });
  if (!doc) redirect(`${redirectTo}?err=noexiste`);
  if (!['ADMIN', 'CENTRAL', 'DEV'].includes(user.role)) redirect(`${redirectTo}?err=rol`);
  if (doc.status === 'AUTORIZADO') redirect(`${redirectTo}?msg=ya`);

  await prisma.doc.update({ where: { id: doc.id }, data: { adminOk: true, status: 'REVISADO' } });
  await logAudit(user, 'Comprobante revisado por Administración', doc.supplier);
  revalidatePath('/caja');
  revalidatePath('/aprobaciones');
  redirect(`${redirectTo}?msg=revisado`);
}

export async function authorizeDocAction(formData: FormData) {
  const user = await requireUser();
  const docId = String(formData.get('docId') || '');
  const redirectTo = String(formData.get('redirectTo') || '/aprobaciones');
  const doc = await prisma.doc.findUnique({ where: { id: docId } });
  if (!doc) redirect(`${redirectTo}?err=noexiste`);
  if (!['GERENCIA', 'CENTRAL', 'DEV'].includes(user.role)) redirect(`${redirectTo}?err=rol`);
  if (!doc.adminOk) redirect(`${redirectTo}?err=admin-primero`);

  await prisma.doc.update({ where: { id: doc.id }, data: { gerenciaOk: true, status: 'AUTORIZADO' } });
  await logAudit(user, 'Comprobante autorizado por Gerencia', `${doc.supplier} · $${doc.total}`);

  await recordBusinessEvent({
    type: 'DOC_AUTHORIZED',
    title: `Comprobante autorizado · ${doc.supplier}`,
    description: `$${doc.total.toLocaleString('es-MX')} · ${doc.category} · listo para el contador (sin póliza automática).`,
    amount: 0,
    unitId: doc.unitId,
    sourceId: doc.id
  });

  revalidatePath('/caja');
  revalidatePath('/aprobaciones');
  redirect(`${redirectTo}?msg=autorizado`);
}

export async function rejectDocAction(formData: FormData) {
  const user = await requireUser();
  const docId = String(formData.get('docId') || '');
  const redirectTo = String(formData.get('redirectTo') || '/aprobaciones');
  const doc = await prisma.doc.findUnique({ where: { id: docId } });
  if (!doc) redirect(`${redirectTo}?err=noexiste`);
  if (!['ADMIN', 'GERENCIA', 'CENTRAL', 'DEV'].includes(user.role)) redirect(`${redirectTo}?err=rol`);

  await prisma.doc.update({ where: { id: doc.id }, data: { status: 'RECHAZADO' } });
  await logAudit(user, 'Comprobante rechazado', doc.supplier);
  revalidatePath('/caja');
  revalidatePath('/aprobaciones');
  redirect(`${redirectTo}?msg=rechazado`);
}

export async function addExpenseAction(formData: FormData) {
  const user = await requireUser();
  const unitId = await getActiveUnitId(user) ?? (await prisma.unit.findFirst())?.id;
  if (!unitId) redirect('/caja');

  const supplier = String(formData.get('supplier') || '').trim();
  const total = parseFloat(String(formData.get('total') || '0')) || 0;
  if (!supplier || total <= 0) redirect('/caja?err=datos');

  await prisma.doc.create({
    data: {
      unitId,
      source: 'MANUAL',
      supplier,
      description: String(formData.get('description') || 'Captura manual'),
      total,
      iva: Math.round((total - total / 1.16) * 100) / 100,
      category: String(formData.get('category') || 'Material de obra'),
      workRef: String(formData.get('workRef') || '') || null,
      confidence: 1,
      status: 'PENDIENTE'
    }
  });
  await logAudit(user, 'Gasto capturado en bandeja', supplier);
  revalidatePath('/caja');
  revalidatePath('/aprobaciones');
  revalidatePath('/hoy');
  redirect('/caja?msg=agregado');
}

function extract(xml: string, tag: string, attr: string): string | null {
  const re = new RegExp(`<[^>]*${tag}[^>]*\\b${attr}\\s*=\\s*"([^"]+)"`, 'i');
  return re.exec(xml)?.[1] ?? null;
}

export async function uploadXmlAction(formData: FormData) {
  const user = await requireUser();
  const unitId = await getActiveUnitId(user) ?? (await prisma.unit.findFirst())?.id;
  if (!unitId) redirect('/caja');

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) redirect('/caja?err=archivo');
  if (file.size > 8 * 1024 * 1024) redirect('/caja?err=tamano');

  const text = await file.text();
  const total = parseFloat(extract(text, 'Comprobante', 'Total') || extract(text, 'Comprobante', 'total') || '0');
  const supplier = extract(text, 'Emisor', 'Nombre') || extract(text, 'Emisor', 'Rfc') || 'Emisor sin nombre';
  const uuid = extract(text, 'TimbreFiscalDigital', 'UUID') || null;

  if (!Number.isFinite(total) || total <= 0 || !/cfdi|comprobante/i.test(text)) {
    redirect('/caja?err=xml');
  }

  if (uuid) {
    const dup = await prisma.doc.findUnique({ where: { uuid } });
    if (dup) redirect('/caja?err=duplicado');
  }

  await prisma.doc.create({
    data: {
      unitId,
      source: 'SAT',
      supplier,
      description: `XML leído en servidor · ${file.name}`,
      total,
      iva: Math.round((total - total / 1.16) * 100) / 100,
      category: 'Por clasificar',
      uuid,
      confidence: 0.95,
      status: 'PENDIENTE'
    }
  });
  await logAudit(user, 'XML CFDI leído y deduplicado por UUID', uuid || file.name);
  revalidatePath('/caja');
  revalidatePath('/aprobaciones');
  revalidatePath('/hoy');
  redirect('/caja?msg=xml');
}
