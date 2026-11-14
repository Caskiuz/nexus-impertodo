import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/session';

const MAX_CHARS = 3_000_000; // ~2.2 MB por foto tras compresión

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  let payload: { clientName?: string; element?: string; title?: string; before?: string; after?: string; otCode?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const clientName = String(payload.clientName || '').trim();
  if (!clientName) return NextResponse.json({ error: 'Falta el nombre del cliente.' }, { status: 400 });

  for (const key of ['before', 'after'] as const) {
    const v = payload[key];
    if (v && (!v.startsWith('data:image/') || v.length > MAX_CHARS)) {
      return NextResponse.json({ error: `La foto del ${key === 'before' ? 'antes' : 'después'} no es válida o pesa demasiado.` }, { status: 400 });
    }
  }

  const user = {
    id: session.user.id,
    name: session.user.name || '',
    email: session.user.email || '',
    role: session.user.role,
    unitId: session.user.unitId ?? null
  };

  const entry = await prisma.portfolioEntry.create({
    data: {
      clientName,
      element: String(payload.element || 'Losa de azotea no transitable'),
      title: payload.title?.trim() || null,
      before: payload.before || null,
      after: payload.after || null,
      otCode: payload.otCode?.trim() || null
    }
  });
  await logAudit(user, 'Evidencia publicada en portafolio', `${clientName}${payload.otCode ? ` · ${payload.otCode}` : ''}`, 'portafolio');

  return NextResponse.json({ ok: true, id: entry.id });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['GERENCIA', 'DEV'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Solo Gerencia o el desarrollador pueden eliminar evidencia.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = String(searchParams.get('id') || '');
  if (!id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });

  const user = {
    id: session.user.id,
    name: session.user.name || '',
    email: session.user.email || '',
    role: session.user.role,
    unitId: session.user.unitId ?? null
  };
  const entry = await prisma.portfolioEntry.findUnique({ where: { id } });
  if (!entry) return NextResponse.json({ error: 'Entrada no encontrada' }, { status: 404 });

  await prisma.portfolioEntry.delete({ where: { id } });
  await logAudit(user, 'Evidencia eliminada del portafolio', `${entry.clientName}${entry.otCode ? ` · ${entry.otCode}` : ''}`, 'portafolio');
  return NextResponse.json({ ok: true });
}
