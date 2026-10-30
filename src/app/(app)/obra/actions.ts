'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser, logAudit } from '@/lib/session';
import { notify } from '@/lib/events';

export async function markPhaseAction(formData: FormData) {
  const user = await requireUser();
  const otId = String(formData.get('otId') || '');
  const ot = await prisma.oT.findUnique({ where: { id: otId } });
  if (!ot) redirect('/obra?err=noexiste');
  if (ot.phasesDone >= ot.phases) redirect('/obra?err=completa');

  const done = ot.phasesDone + 1;
  await prisma.oT.update({
    where: { id: ot.id },
    data: {
      phasesDone: done,
      matReal: ot.matReal + Math.round(ot.matTheo / ot.phases),
      laborReal: ot.laborReal + Math.round(ot.area / ot.phases),
      status: ot.status === 'POR_INICIAR' ? 'EN_OBRA' : ot.status
    }
  });
  await prisma.oTPhoto.create({
    data: { otId: ot.id, phase: done, label: `Evidencia fase ${done} registrada (demo: foto geolocalizada)` }
  });
  await logAudit(user, 'Fase de obra registrada con evidencia', `${ot.code} · fase ${done}`);
  revalidatePath('/obra');
  revalidatePath('/hoy');
  redirect('/obra?ot=' + ot.code + '&msg=fase');
}

export async function setRealMaterialAction(formData: FormData) {
  const user = await requireUser();
  const otId = String(formData.get('otId') || '');
  const value = parseFloat(String(formData.get('matReal') || '0')) || 0;
  const ot = await prisma.oT.findUnique({ where: { id: otId } });
  if (!ot) redirect('/obra');
  await prisma.oT.update({ where: { id: ot.id }, data: { matReal: Math.max(0, value) } });
  await logAudit(user, 'Consumo real de material actualizado', ot.code);
  revalidatePath('/obra');
  redirect('/obra?ot=' + ot.code);
}

export async function deliverAction(formData: FormData) {
  const user = await requireUser();
  const otId = String(formData.get('otId') || '');
  const ot = await prisma.oT.findUnique({ where: { id: otId } });
  if (!ot) redirect('/obra?err=noexiste');
  if (ot.phasesDone < ot.phases) redirect('/obra?ot=' + ot.code + '&err=fases');

  await prisma.oT.update({
    where: { id: ot.id },
    data: {
      status: 'ENTREGADA',
      phasesDone: ot.phases,
      deliveredAt: new Date(),
      signature: 'Firma del cliente registrada en pantalla (demo)'
    }
  });

  const sys = await prisma.system.findUnique({ where: { key: ot.systemKey } });
  const client = await prisma.client.findFirst({ where: { unitId: ot.unitId, name: ot.clientName } });
  if (client && sys) {
    const warrantyUntil = new Date();
    warrantyUntil.setFullYear(warrantyUntil.getFullYear() + Math.max(1, Math.round(sys.warranty)));
    await prisma.asset.create({
      data: { clientId: client.id, name: `Garantía ${ot.code} · ${sys.short}`, area: ot.area, warrantyUntil, note: 'Garantía digital emitida al entregar' }
    });
  }

  await notify('Obra entregada · garantía digital emitida', `${ot.code} · ${ot.clientName}. CFDI de finiquito pendiente de timbrar (fuera del sistema).`, 'SYSTEM');
  await logAudit(user, 'Obra entregada y garantía digital emitida', ot.code);
  revalidatePath('/obra');
  revalidatePath('/clientes');
  redirect('/obra?ot=' + ot.code + '&msg=entregada');
}
