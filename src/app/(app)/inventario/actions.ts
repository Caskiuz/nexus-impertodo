'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser, logAudit } from '@/lib/session';
import { notify } from '@/lib/events';

export async function addStockAction(formData: FormData) {
  const user = await requireUser();
  const itemId = String(formData.get('itemId') || '');
  const qty = parseFloat(String(formData.get('qty') || '0')) || 0;
  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item || qty === 0) redirect('/inventario?err=datos');

  await prisma.inventoryItem.update({ where: { id: item.id }, data: { stock: Math.max(0, item.stock + qty) } });
  await prisma.stockMovement.create({ data: { itemId: item.id, qty, reason: qty > 0 ? 'Entrada manual' : 'Salida manual' } });
  await logAudit(user, qty > 0 ? 'Entrada de inventario' : 'Salida de inventario', `${item.name} · ${qty}`);
  revalidatePath('/inventario');
  redirect('/inventario?msg=movimiento');
}

export async function suggestOrderAction(formData: FormData) {
  const user = await requireUser();
  const itemId = String(formData.get('itemId') || '');
  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item) redirect('/inventario?err=noexiste');

  const suggested = Math.max(item.min * 2 - item.stock, 0);
  await notify(
    'Pedido propuesto · ' + item.name,
    `Stock ${item.stock} bajo mínimo ${item.min}. Pedido sugerido: ${suggested} ${item.unitName}. Compra exclusiva PROSEALMASTER (precio de compra; landed oculto).`,
    'ORDER'
  );
  await logAudit(user, 'Pedido de material propuesto', item.name);
  revalidatePath('/inventario');
  redirect('/inventario?msg=pedido');
}

export async function createProductAction(formData: FormData) {
  const user = await requireUser();
  if (!['ADMIN', 'CENTRAL', 'DEV', 'GERENCIA'].includes(user.role)) redirect('/inventario?err=rol');

  const name = String(formData.get('name') || '').trim();
  const unitName = String(formData.get('unitName') || '').trim() || 'cubeta';
  const stock = Math.max(0, parseFloat(String(formData.get('stock') || '0')) || 0);
  const min = Math.max(0, parseFloat(String(formData.get('min') || '0')) || 0);
  const cost = Math.max(0, parseFloat(String(formData.get('cost') || '0')) || 0);
  const provider = String(formData.get('provider') || '').trim() || 'PROSEALMASTER';

  if (!name) redirect('/inventario?err=alta');

  const item = await prisma.inventoryItem.create({
    data: { name, stock, min, unitName, cost, provider }
  });

  if (stock > 0) {
    await prisma.stockMovement.create({
      data: { itemId: item.id, qty: stock, reason: 'Alta de producto · stock inicial' }
    });
  }

  await logAudit(
    user,
    'Producto nuevo en inventario',
    `${name} · stock inicial ${stock} ${unitName} · mínimo ${min} · costo ${cost} · ${provider}`
  );

  revalidatePath('/inventario');
  revalidatePath('/hoy');
  revalidatePath('/agentes');
  redirect('/inventario?msg=creado');
}

export async function updateProductAction(formData: FormData) {
  const user = await requireUser();
  if (!['ADMIN', 'CENTRAL', 'DEV', 'GERENCIA'].includes(user.role)) redirect('/inventario?err=rol');

  const id = String(formData.get('id') || '');
  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item) redirect('/inventario?err=noexiste');

  const name = String(formData.get('name') || '').trim();
  if (!name) redirect(`/inventario?edit=${id}&err=alta`);
  const unitName = String(formData.get('unitName') || '').trim() || item.unitName;
  const min = Math.max(0, parseFloat(String(formData.get('min') || String(item.min))) || item.min);
  const cost = Math.max(0, parseFloat(String(formData.get('cost') || String(item.cost))) || item.cost);
  const provider = String(formData.get('provider') || '').trim() || item.provider;

  await prisma.inventoryItem.update({ where: { id }, data: { name, unitName, min, cost, provider } });
  await logAudit(user, 'Producto editado', `${name} · unidad ${unitName} · mínimo ${min} · costo ${cost} · ${provider}`);

  revalidatePath('/inventario');
  revalidatePath('/hoy');
  redirect('/inventario?msg=editado');
}

export async function deleteProductAction(formData: FormData) {
  const user = await requireUser();
  if (!['ADMIN', 'CENTRAL', 'DEV', 'GERENCIA'].includes(user.role)) redirect('/inventario?err=rol');

  const id = String(formData.get('id') || '');
  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item) redirect('/inventario?err=noexiste');

  await prisma.stockMovement.deleteMany({ where: { itemId: id } });
  await prisma.inventoryItem.delete({ where: { id } });
  await logAudit(user, 'Producto eliminado', `${item.name} · stock al eliminar ${item.stock} ${item.unitName}`);

  revalidatePath('/inventario');
  revalidatePath('/hoy');
  redirect('/inventario?msg=eliminado');
}
