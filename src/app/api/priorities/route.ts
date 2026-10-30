import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getActiveUnitId, type SessionUser } from '@/lib/session';
import { askGemini } from '@/lib/gemini';

function fmt(n: number) {
  return '$' + Math.round(n || 0).toLocaleString('es-MX');
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const user: SessionUser = {
    id: session.user.id,
    name: session.user.name || '',
    email: session.user.email || '',
    role: session.user.role,
    unitId: session.user.unitId ?? null
  };

  const unitId = await getActiveUnitId(user);
  const scope = unitId ? { unitId } : {};

  const [quotes, docs, invoices, inventory, tenders, settings] = await Promise.all([
    prisma.quote.findMany({ where: scope, orderBy: { createdAt: 'asc' } }),
    prisma.doc.findMany({ where: scope, orderBy: { date: 'desc' } }),
    prisma.invoice.findMany({ where: scope }),
    prisma.inventoryItem.findMany(),
    prisma.tender.findMany({ where: scope, orderBy: { openingDate: 'asc' } }),
    prisma.settings.findUnique({ where: { id: 'default' } })
  ]);

  const floor = settings?.floor ?? 30;
  const pendingQuotes = quotes.filter((q) => q.status === 'BORRADOR' || q.status === 'ENVIADA');
  const lowMargin = quotes.filter((q) => q.margin * 100 < floor && q.status !== 'APROBADA');
  const stale = quotes.filter((q) => q.status === 'ENVIADA' && Date.now() - q.createdAt.getTime() > 14 * 86400000);
  const pendingDocs = docs.filter((d) => d.status === 'PENDIENTE' || d.status === 'REVISADO');
  const flaggedDocs = docs.filter((d) => Boolean(d.warn));
  const overdue = invoices.filter((i) => i.status === 'PENDIENTE' && i.dueDate < new Date());
  const lowStock = inventory.filter((i) => i.stock < i.min);

  const lines = [
    `Fecha: ${new Date().toLocaleDateString('es-MX')} · Unidad: ${unitId ? 'seleccionada' : 'todas'}`,
    `Cotizaciones por aprobar: ${pendingQuotes.length}${pendingQuotes.length ? ' (' + pendingQuotes.slice(0, 5).map((q) => `${q.folio} ${fmt(q.total)}`).join(', ') + ')' : ''}`,
    `Margen bajo piso (${floor}%): ${lowMargin.map((q) => `${q.folio} ${(q.margin * 100).toFixed(0)}%`).join(', ') || 'ninguna'}`,
    `Cotizaciones enviadas sin respuesta +14 días: ${stale.map((q) => `${q.folio} (${Math.round((Date.now() - q.createdAt.getTime()) / 86400000)} días)`).join(', ') || 'ninguna'}`,
    `Comprobantes en bandeja: ${pendingDocs.length}; con alerta: ${flaggedDocs.map((d) => `${d.supplier} (${d.warn})`).join(', ') || 'ninguno'}`,
    `Facturas vencidas: ${overdue.map((i) => `${i.clientName} ${fmt(i.amount)}`).join(', ') || 'ninguna'}`,
    `Productos bajo mínimo: ${lowStock.map((i) => `${i.name} ${i.stock}/${i.min}`).join(', ') || 'ninguno'}`,
    `Licitaciones próximas: ${tenders.slice(0, 3).map((t) => `${t.convener} match ${t.match}% apertura ${t.openingDate.toLocaleDateString('es-MX')}`).join(', ') || 'ninguna'}`
  ];

  const system = [
    'Eres el copiloto de IMPERTODO AI OS (impermeabilización, Torreón).',
    'Con las detecciones del sistema, prioriza el día del gerente.',
    'Entrega máximo 5 acciones ordenadas por impacto, cada una con módulo y motivo breve.',
    'Texto plano, sin markdown, máximo 150 palabras. Usa solo los datos dados; no inventes.',
    'Usa el nombre exacto de estos módulos: Hoy; Cotizar; Clientes & Techos; Propuesta viva; Marketing / Captación; Obra / OT; Inventario; Caja / Contabilidad; Cobrar; Aprobaciones; Licitaciones; Franquicias; Central (red); Catálogo / Precios; Agentes IA; Notificaciones.',
    'Para autorizar cotizaciones o comprobantes, el módulo es Aprobaciones. Propuesta viva es solo el enlace del cliente.',
    'Nunca recomiendes autorizar documentos con alerta (sin CFDI, 69-B, datos incompletos): recomienda revisión, corrección o rechazo.',
    'Si un hallazgo es crítico (69-B, margen bajo piso, cobranza vencida), ponlo primero.',
    'La IA sugiere, el humano aprueba. No ejecutes acciones.'
  ].join('\n');

  const result = await askGemini(system, `DETECCIONES ACTUALES:\n${lines.join('\n')}\n\nPrioriza las acciones de hoy.`, 800);

  return NextResponse.json({
    reply:
      result.text ||
      `No pude conectar con la IA. Prioriza manualmente:\n${lines.slice(1).join('\n')}\n\nLa IA sugiere, el humano aprueba.`,
    mode: result.mode,
    reason: result.reason
  });
}
