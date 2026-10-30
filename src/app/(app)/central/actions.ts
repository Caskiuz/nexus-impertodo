'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser, logAudit } from '@/lib/session';
import { recordBusinessEvent } from '@/lib/events';
import { periodOf } from '@/lib/constants';

function canOperate(role: string) {
  return ['CENTRAL', 'DEV', 'GERENCIA'].includes(role);
}

export async function registerSaleAction(formData: FormData) {
  const user = await requireUser();
  if (!canOperate(user.role)) redirect('/central?err=rol');

  const unitId = String(formData.get('unitId') || '');
  const amount = parseFloat(String(formData.get('amount') || '0')) || 0;
  const description = String(formData.get('description') || '').trim();
  const customer = String(formData.get('customer') || '').trim();
  const uuid = String(formData.get('uuid') || '').trim() || null;
  const folio = String(formData.get('folio') || '').trim() || null;

  if (!unitId || amount <= 0 || !description || !customer) redirect('/central?err=datos');
  if (uuid) {
    const dup = await prisma.sale.findUnique({ where: { uuid } });
    if (dup) redirect('/central?err=duplicado');
  }

  await prisma.sale.create({
    data: { unitId, description, amount, customer, uuid, folio, date: new Date() }
  });
  await logAudit(user, 'Venta timbrada registrada', `${customer} · $${amount}`);
  revalidatePath('/central');
  revalidatePath('/franquicias');
  revalidatePath('/comisiones');
  redirect('/central?msg=venta');
}

export async function calculateRoyaltyAction(formData: FormData) {
  const user = await requireUser();
  if (!canOperate(user.role)) redirect('/central?err=rol');

  const unitId = String(formData.get('unitId') || '');
  const period = String(formData.get('period') || periodOf(new Date()));
  if (!unitId || !/^\d{4}-\d{2}$/.test(period)) redirect('/central?err=datos');

  const sales = await prisma.sale.findMany({ where: { unitId } });
  const total = sales.filter((s) => periodOf(s.date) === period).reduce((x, s) => x + s.amount, 0);
  if (total <= 0) redirect('/central?err=sinventas');

  const royalty6 = Math.round(total * 0.06 * 100) / 100;
  const marketing2 = Math.round(total * 0.02 * 100) / 100;
  const royalTotal = Math.round((royalty6 + marketing2) * 100) / 100;

  const existing = await prisma.royaltyPeriod.findUnique({ where: { unitId_period: { unitId, period } } });
  const delta = Math.round((royalTotal - (existing?.total || 0)) * 100) / 100;

  await prisma.royaltyPeriod.upsert({
    where: { unitId_period: { unitId, period } },
    create: { unitId, period, salesTotal: total, royalty6, marketing2, total: royalTotal, status: 'CALCULADA' },
    update: { salesTotal: total, royalty6, marketing2, total: royalTotal, status: 'CALCULADA' }
  });

  if (delta > 0) {
    await recordBusinessEvent({
      type: 'ROYALTY_CALCULATED',
      title: `Regalía calculada · ${period}`,
      description: `Ventas timbradas $${total.toLocaleString('es-MX')} → regalía 6% ($${royalty6.toLocaleString('es-MX')}) + marketing 2% ($${marketing2.toLocaleString('es-MX')}).`,
      amount: delta,
      unitId
    });
  }

  await logAudit(user, 'Regalía calculada', `${period} · $${royalTotal}`);
  revalidatePath('/central');
  revalidatePath('/franquicias');
  revalidatePath('/comisiones');
  revalidatePath('/notificaciones');
  redirect('/central?msg=regalia');
}

export async function chargeTechFeeAction(formData: FormData) {
  const user = await requireUser();
  if (!canOperate(user.role)) redirect('/central?err=rol');

  const unitId = String(formData.get('unitId') || '');
  const period = String(formData.get('period') || periodOf(new Date()));
  if (!unitId) redirect('/central?err=datos');

  const existing = await prisma.techFee.findUnique({ where: { unitId_period: { unitId, period } } });
  if (existing) redirect('/central?msg=feeexistente');

  await prisma.techFee.create({ data: { unitId, period, amount: 2500, status: 'PENDIENTE' } });
  await recordBusinessEvent({
    type: 'TECH_FEE',
    title: `Fee tecnológico · ${period}`,
    description: 'Fee mensual por unidad: $2,500.',
    amount: 2500,
    unitId
  });
  await logAudit(user, 'Fee tecnológico generado', period);
  revalidatePath('/central');
  revalidatePath('/comisiones');
  revalidatePath('/notificaciones');
  redirect('/central?msg=fee');
}

export async function createProductOrderAction(formData: FormData) {
  const user = await requireUser();
  if (!canOperate(user.role)) redirect('/central?err=rol');

  const unitId = String(formData.get('unitId') || '');
  const item = String(formData.get('item') || '').trim();
  const qty = parseFloat(String(formData.get('qty') || '0')) || 0;
  const unitPrice = parseFloat(String(formData.get('unitPrice') || '0')) || 0;
  if (!unitId || !item || qty <= 0 || unitPrice <= 0) redirect('/central?err=datos');

  const total = Math.round(qty * unitPrice * 100) / 100;
  await prisma.productOrder.create({
    data: { unitId, item, qty, unitPrice, total, status: 'SOLICITADO' }
  });
  await recordBusinessEvent({
    type: 'PRODUCT_ORDER',
    title: 'Pedido de producto de la red',
    description: `${item} · ${qty} unidades · $${total.toLocaleString('es-MX')}. Compra exclusiva PROSEALMASTER.`,
    amount: total,
    unitId
  });
  await logAudit(user, 'Pedido de producto registrado', `${item} · ${qty}`);
  revalidatePath('/central');
  revalidatePath('/comisiones');
  revalidatePath('/notificaciones');
  redirect('/central?msg=pedido');
}

export async function markRoyaltyPaidAction(formData: FormData) {
  const user = await requireUser();
  if (!canOperate(user.role)) redirect('/central?err=rol');
  const id = String(formData.get('id') || '');
  await prisma.royaltyPeriod.update({ where: { id }, data: { status: 'PAGADA' } });
  await logAudit(user, 'Regalía marcada como pagada (manual)', id);
  revalidatePath('/central');
  redirect('/central?msg=pagada');
}

export async function markFeePaidAction(formData: FormData) {
  const user = await requireUser();
  if (!canOperate(user.role)) redirect('/central?err=rol');
  const id = String(formData.get('id') || '');
  await prisma.techFee.update({ where: { id }, data: { status: 'PAGADO' } });
  await logAudit(user, 'Fee tecnológico marcado como pagado', id);
  revalidatePath('/central');
  redirect('/central?msg=pagada');
}
