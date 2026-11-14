'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser, logAudit } from '@/lib/session';
import { notify } from '@/lib/events';

// Roles con autorización para modificar datos maestros del inventario.
const CAN_EDIT_INVENTORY = ['GERENCIA', 'DEV'];

export async function addStockAction(formData: FormData) {
  const user = await requireUser();
  const itemId = String(formData.get('itemId') || '');
  const qty = Math.abs(parseFloat(String(formData.get('qty') || '0')) || 0);
  const kind = String(formData.get('kind') || 'ENTRADA').toUpperCase() === 'SALIDA' ? 'SALIDA' : 'ENTRADA';
  const docRef = String(formData.get('docRef') || '').trim();
  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item || qty === 0) redirect('/inventario?err=datos');

  const signedQty = kind === 'SALIDA' ? -qty : qty;
  const newStock = Math.max(0, item.stock + signedQty);

  await prisma.inventoryItem.update({ where: { id: item.id }, data: { stock: newStock } });
  await prisma.stockMovement.create({
    data: {
      itemId: item.id,
      qty: signedQty,
      type: kind,
      reason: kind === 'ENTRADA' ? 'Entrada a almacén' : 'Salida de almacén',
      docRef: docRef || null,
      userName: user.name,
      balance: newStock
    }
  });
  await logAudit(user, kind === 'ENTRADA' ? 'Entrada de inventario' : 'Salida de inventario', `${item.name} · ${kind === 'ENTRADA' ? '+' : '−'}${qty} ${item.unitName}${docRef ? ` · ${docRef}` : ''}`, 'inventario');
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
  await logAudit(user, 'Pedido de material propuesto', item.name, 'inventario');
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
      data: {
        itemId: item.id,
        qty: stock,
        type: 'ENTRADA',
        reason: 'Alta de producto · stock inicial',
        userName: user.name,
        balance: stock
      }
    });
  }

  await logAudit(
    user,
    'Producto nuevo en inventario',
    `${name} · stock inicial ${stock} ${unitName} · mínimo ${min} · costo ${cost} · ${provider}`,
    'inventario'
  );

  revalidatePath('/inventario');
  revalidatePath('/hoy');
  revalidatePath('/agentes');
  redirect('/inventario?msg=creado');
}

export async function updateProductAction(formData: FormData) {
  const user = await requireUser();
  if (!CAN_EDIT_INVENTORY.includes(user.role)) redirect('/inventario?err=autoriza');

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

  // Bitácora explícita: antes → después de cada campo modificado.
  const changes: string[] = [];
  if (name !== item.name) changes.push(`nombre: ${item.name} → ${name}`);
  if (unitName !== item.unitName) changes.push(`unidad: ${item.unitName} → ${unitName}`);
  if (min !== item.min) changes.push(`mínimo: ${item.min} → ${min}`);
  if (cost !== item.cost) changes.push(`costo: $${item.cost} → $${cost}`);
  if (provider !== item.provider) changes.push(`proveedor: ${item.provider} → ${provider}`);

  await logAudit(
    user,
    'Producto modificado',
    `${name}${changes.length ? ' · ' + changes.join(' · ') : ' (sin cambios) · autorizado por ' + user.role}`,
    'inventario'
  );

  revalidatePath('/inventario');
  revalidatePath('/hoy');
  redirect('/inventario?msg=editado');
}

export async function deleteProductAction(formData: FormData) {
  const user = await requireUser();
  if (!CAN_EDIT_INVENTORY.includes(user.role)) redirect('/inventario?err=autoriza');

  const id = String(formData.get('id') || '');
  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item) redirect('/inventario?err=noexiste');

  await prisma.stockMovement.deleteMany({ where: { itemId: id } });
  await prisma.inventoryItem.delete({ where: { id } });
  await logAudit(user, 'Producto eliminado', `${item.name} · stock al eliminar ${item.stock} ${item.unitName} · autorizado por ${user.role}`, 'inventario');

  revalidatePath('/inventario');
  revalidatePath('/hoy');
  redirect('/inventario?msg=eliminado');
}
