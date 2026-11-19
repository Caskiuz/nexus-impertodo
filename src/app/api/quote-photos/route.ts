import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/session';

const MAX_CHARS = 3_000_000; // ~2.2 MB por foto tras compresión
const MAX_PHOTOS = 8;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  let payload: { image?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const image = String(payload.image || '');
  if (!image.startsWith('data:image/')) {
    return NextResponse.json({ error: 'Archivo no válido: debe ser una imagen.' }, { status: 400 });
  }
  if (image.length > MAX_CHARS) {
    return NextResponse.json({ error: 'La imagen es demasiado grande.' }, { status: 413 });
  }

  const staged = await prisma.quotePhoto.count({ where: { quoteId: null } });
  if (staged > 200) {
    return NextResponse.json({ error: 'Demasiadas fotos sin asignar. Intenta más tarde.' }, { status: 429 });
  }

  const row = await prisma.quotePhoto.create({ data: { dataUrl: image } });
  if (row.id.length === 0) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 });

  const user = {
    id: session.user.id,
    name: session.user.name || '',
    email: session.user.email || '',
    role: session.user.role,
    unitId: session.user.unitId ?? null
  };
  await logAudit(user, 'Foto de área adjuntada al diagnóstico', `foto ${row.id.slice(0, 8)} (${MAX_PHOTOS} máx por cotización)`, 'cotizar');

  return NextResponse.json({ ok: true, id: row.id });
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const ids = (searchParams.get('ids') || '').split(',').filter(Boolean).slice(0, MAX_PHOTOS);
  if (!ids.length) return NextResponse.json({ ok: true, photos: [] });

  const rows = await prisma.quotePhoto.findMany({
    where: { id: { in: ids } },
    select: { id: true, dataUrl: true },
    orderBy: { createdAt: 'asc' }
  });
  return NextResponse.json({ ok: true, photos: rows.map((r) => ({ id: r.id, dataUrl: r.dataUrl })) });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = String(searchParams.get('id') || '');
  if (!id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });

  const row = await prisma.quotePhoto.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: 'Foto no encontrada' }, { status: 404 });

  // Las fotos sin cotización (borrador) cualquiera las quita; las ligadas a una cotización, solo Gerencia/DEV.
  if (row.quoteId && !['GERENCIA', 'DEV'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Solo Gerencia o el desarrollador pueden quitar fotos de una cotización guardada.' }, { status: 403 });
  }

  await prisma.quotePhoto.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
