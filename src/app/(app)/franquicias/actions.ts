'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser, logAudit } from '@/lib/session';
import { recordBusinessEvent } from '@/lib/events';

export async function createFranchiseAction(formData: FormData) {
  const user = await requireUser();
  if (!['CENTRAL', 'DEV', 'GERENCIA'].includes(user.role)) redirect('/franquicias?err=rol');

  const name = String(formData.get('name') || '').trim();
  if (!name) redirect('/franquicias?err=datos');
  const investment = parseFloat(String(formData.get('investment') || '0')) || null;

  await prisma.franchise.create({
    data: {
      name,
      city: String(formData.get('city') || ''),
      contact: String(formData.get('contact') || ''),
      stage: String(formData.get('stage') || 'PROSPECTO'),
      investment,
      feasibility: String(formData.get('feasibility') || 'Por evaluar')
    }
  });
  await logAudit(user, 'Prospecto de franquicia creado', name);
  revalidatePath('/franquicias');
  redirect('/franquicias?msg=creado');
}

export async function acquireFranchiseAction(formData: FormData) {
  const user = await requireUser();
  if (!['CENTRAL', 'DEV', 'GERENCIA'].includes(user.role)) redirect('/franquicias?err=rol');

  const franchiseId = String(formData.get('franchiseId') || '');
  const fee = parseFloat(String(formData.get('fee') || '0')) || 0;
  const fr = await prisma.franchise.findUnique({ where: { id: franchiseId } });
  if (!fr) redirect('/franquicias?err=noexiste');
  if (fee <= 0) redirect('/franquicias?err=datos');

  let unitId = fr.unitId;
  if (!unitId) {
    const existing = await prisma.unit.findFirst({ where: { name: fr.name } });
    if (existing) {
      await prisma.unit.update({
        where: { id: existing.id },
        data: { kind: 'ACTIVA', model: 'Franquicia', investment: fr.investment ?? existing.investment, feasibility: fr.feasibility }
      });
      unitId = existing.id;
    } else {
      const unit = await prisma.unit.create({
        data: { name: fr.name, city: fr.city, kind: 'ACTIVA', model: 'Franquicia', investment: fr.investment, feasibility: fr.feasibility }
      });
      unitId = unit.id;
    }
  }
  await prisma.franchise.update({
    where: { id: fr.id },
    data: { stage: 'ACTIVA', fee, unitId }
  });

  await recordBusinessEvent({
    type: 'FRANCHISE_ACQUIRED',
    title: `Franquicia adquirida · ${fr.name}`,
    description: `Cuota inicial $${fee.toLocaleString('es-MX')}. Unidad activada en la red.`,
    amount: fee,
    unitId,
    sourceId: fr.id
  });
  await logAudit(user, 'Franquicia adquirida y unidad activada', fr.name);
  revalidatePath('/franquicias');
  revalidatePath('/central');
  revalidatePath('/comisiones');
  revalidatePath('/notificaciones');
  redirect('/franquicias?msg=adquirida');
}
