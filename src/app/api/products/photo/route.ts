import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/session';

const MAX_CHARS = 3_000_000; // ~2.2 MB de imagen tras compresión
const ROLES = ['ADMIN', 'CENTRAL', 'DEV', 'GERENCIA'];

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!ROLES.includes(session.user.role)) return NextResponse.json({ error: 'Rol sin permiso' }, { status: 403 });

  let payload: { itemId?: string; image?: string; remove?: boolean };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const itemId = String(payload.itemId || '');
  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

  const user = {
    id: session.user.id,
    name: session.user.name || '',
    email: session.user.email || '',
    role: session.user.role,
    unitId: session.user.unitId ?? null
  };

  if (payload.remove) {
    await prisma.inventoryItem.update({ where: { id: item.id }, data: { photo: null } });
    await logAudit(user, 'Foto de producto eliminada', item.name);
    return NextResponse.json({ ok: true, removed: true });
  }

  const image = String(payload.image || '');
  if (!image.startsWith('data:image/')) {
    return NextResponse.json({ error: 'Archivo no válido: debe ser una imagen.' }, { status: 400 });
  }
  if (image.length > MAX_CHARS) {
    return NextResponse.json({ error: 'La imagen es demasiado grande.' }, { status: 413 });
  }

  await prisma.inventoryItem.update({ where: { id: item.id }, data: { photo: image } });
  await logAudit(user, 'Foto de producto actualizada', item.name);

  return NextResponse.json({ ok: true });
}
