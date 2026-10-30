'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser, getActiveUnitId, logAudit } from '@/lib/session';
import { notify } from '@/lib/events';
import { fmt } from '@/lib/constants';

export async function estimateLeadAction(formData: FormData) {
  const user = await requireUser();
  const unitId = await getActiveUnitId(user) ?? (await prisma.unit.findFirst())?.id;
  if (!unitId) redirect('/captacion');

  const m2 = parseFloat(String(formData.get('m2') || '0')) || 0;
  const tipo = String(formData.get('tipo') || 'Azotea de casa');
  const phone = String(formData.get('phone') || '');
  const lo = tipo.includes('Nave') ? 199 : 169;
  const hi = tipo.includes('Nave') ? 260 : 390;
  if (m2 <= 0) redirect('/captacion?err=m2');

  await prisma.lead.create({
    data: {
      unitId,
      company: `Lead web · ${tipo}`,
      phone,
      sector: tipo.includes('Nave') ? 'Industrial' : tipo.includes('casa') || tipo.includes('Casa') ? 'Residencial' : 'Comercial',
      project: tipo,
      area: m2,
      amount: m2 * lo,
      stage: 0,
      source: 'Estimador web',
      nextAction: 'Llamar en 10 minutos',
      heat: 'cool'
    }
  });
  await logAudit(user, 'Lead creado desde estimador web', `${m2} m² · ${tipo}`);
  revalidatePath('/captacion');
  revalidatePath('/clientes');
  redirect(`/captacion?msg=lead&lo=${Math.round(m2 * lo)}&hi=${Math.round(m2 * hi)}`);
}

export async function startSequenceAction(formData: FormData) {
  const user = await requireUser();
  const company = String(formData.get('company') || 'Cuenta');
  await notify('Secuencia de 3 toques creada', `Radar de techos: ${company}. El agente preparará contacto (envío manual, sin mensajes automáticos).`, 'SYSTEM');
  await logAudit(user, 'Secuencia de captación creada', company);
  revalidatePath('/captacion');
  redirect('/captacion?msg=secuencia');
}
