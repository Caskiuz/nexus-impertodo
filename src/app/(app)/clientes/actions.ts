'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser, getActiveUnitId, logAudit } from '@/lib/session';

export async function advanceLeadAction(formData: FormData) {
  const user = await requireUser();
  const leadId = String(formData.get('leadId') || '');
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return;
  await prisma.lead.update({
    where: { id: lead.id },
    data: { stage: Math.min(4, lead.stage + 1), daysInStage: 0 }
  });
  await logAudit(user, 'Lead avanzado de etapa', lead.company);
  revalidatePath('/clientes');
  revalidatePath('/hoy');
}

export async function createLeadAction(formData: FormData) {
  const user = await requireUser();
  const unitId = await getActiveUnitId(user) ?? (await prisma.unit.findFirst())?.id;
  if (!unitId) redirect('/clientes');

  const company = String(formData.get('company') || '').trim();
  if (!company) redirect('/clientes?err=empresa');

  const area = parseFloat(String(formData.get('area') || '0')) || 0;
  const amount = parseFloat(String(formData.get('amount') || '0')) || 0;

  await prisma.lead.create({
    data: {
      unitId,
      company,
      contact: String(formData.get('contact') || ''),
      phone: String(formData.get('phone') || ''),
      sector: String(formData.get('sector') || 'Comercial'),
      project: String(formData.get('project') || ''),
      address: String(formData.get('address') || ''),
      area,
      amount,
      stage: 0,
      source: String(formData.get('source') || 'Captura manual'),
      nextAction: 'Agendar visita',
      heat: 'cool'
    }
  });
  await logAudit(user, 'Prospecto creado', company);
  revalidatePath('/clientes');
  revalidatePath('/hoy');
  redirect('/clientes?msg=creado');
}
