'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser, logAudit } from '@/lib/session';

function canEdit(role: string) {
  return ['ADMIN', 'CENTRAL', 'DEV'].includes(role);
}

export async function saveSettingsAction(formData: FormData) {
  const user = await requireUser();
  if (!canEdit(user.role)) redirect('/catalogo?err=rol');

  const floor = Math.min(90, Math.max(0, parseFloat(String(formData.get('floor') || '30')) || 30));
  const indirect = Math.min(100, Math.max(0, parseFloat(String(formData.get('indirect') || '8')) || 8));
  const provider = String(formData.get('provider') || 'nac') === 'psm' ? 'psm' : 'nac';

  await prisma.settings.upsert({
    where: { id: 'default' },
    create: { id: 'default', floor, indirect, provider },
    update: { floor, indirect, provider }
  });
  await logAudit(user, 'Parámetros de catálogo actualizados', `piso ${floor}% · indirectos ${indirect}% · ${provider}`);
  revalidatePath('/catalogo');
  revalidatePath('/cotizar');
  redirect('/catalogo?msg=guardado');
}

export async function saveCostSheetAction(formData: FormData) {
  const user = await requireUser();
  if (!canEdit(user.role)) redirect('/catalogo?err=rol');

  const systemKey = String(formData.get('systemKey') || '');
  const system = await prisma.system.findUnique({ where: { key: systemKey } });
  if (!system) redirect('/catalogo?err=sistema');

  const supplier = String(formData.get('supplier') || '').trim();
  const source = String(formData.get('source') || '').trim();
  const technical = String(formData.get('technical') || '').trim();
  const material = parseFloat(String(formData.get('material') || '0')) || 0;
  const labor = parseFloat(String(formData.get('labor') || '0')) || 0;
  const prep = parseFloat(String(formData.get('prep') || '0')) || 0;
  const waste = Math.min(50, Math.max(0, parseFloat(String(formData.get('waste') || '0')) || 0));
  const confirmed = formData.get('confirmed') === 'on';

  if (!supplier || !source || !technical) redirect('/catalogo?err=evidencia');

  await prisma.costSheet.upsert({
    where: { systemKey },
    create: { systemKey, supplier, source, technical, material, labor, prep, waste, confirmed },
    update: { supplier, source, technical, material, labor, prep, waste, confirmed }
  });
  await logAudit(user, 'Ficha de costos guardada', `${systemKey} · ${supplier}`);
  revalidatePath('/catalogo');
  revalidatePath('/cotizar');
  redirect('/catalogo?msg=ficha&sys=' + systemKey);
}
