import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getActiveUnitId, type SessionUser } from '@/lib/session';
import { askGemini } from '@/lib/gemini';

type AgentKey = 'documentos' | 'comercial' | 'tecnico' | 'financiero' | 'compras' | 'licitaciones';

const LABELS: Record<AgentKey, string> = {
  documentos: 'Agente de documentos',
  comercial: 'Agente comercial',
  tecnico: 'Agente técnico',
  financiero: 'Agente financiero',
  compras: 'Agente de compras',
  licitaciones: 'Agente de licitaciones'
};

// Caché corto en memoria para evitar llamadas repetidas a Gemini (cuota y latencia).
const cache = new Map<string, { at: number; reply: string }>();
const CACHE_MS = 60_000;

const ROLES: Record<AgentKey, string> = {
  documentos:
    'Revisas la bandeja de comprobantes: XML CFDI, capturas y alertas. Detecta UUID duplicados, proveedores en lista 69-B, comprobantes sin RFC o datos incompletos y montos inusuales. No contabilizas ni pagas.',
  comercial:
    'Revisas el embudo comercial. Prioriza seguimientos por antigüedad, valor y temperatura; detecta cotizaciones sin respuesta. No envías mensajes; propones la siguiente acción concreta.',
  tecnico:
    'Revisas la coherencia técnica de las cotizaciones: sistema elegido, espesores, costos documentados, áreas verificadas y garantías. No autorizas; señalas qué validar con el supervisor.',
  financiero:
    'Revisas márgenes, cobranza y comprobantes de riesgo. Detecta margen bajo el piso, facturas vencidas, gastos sin soporte y alertas fiscales. No pagas ni contabilizas.',
  compras:
    'Revisas inventario y reposición. Sugieres qué pedir por mínimos y comparas costo instalado. La compra es exclusiva PROSEALMASTER; el franquiciado ve precio de compra, no landed. No compras.',
  licitaciones:
    'Revisas licitaciones detectadas. Priorizas por coincidencia, fecha de apertura y requisitos; sugieres preparar expediente. No envías propuestas.'
};

function fmt(n: number) {
  return '$' + Math.round(n || 0).toLocaleString('es-MX');
}

async function buildContext(agent: AgentKey, unitId: string | null): Promise<string> {
  const scope = unitId ? { unitId } : {};

  if (agent === 'documentos' || agent === 'financiero') {
    const [docs, invoices, quotes] = await Promise.all([
      prisma.doc.findMany({ where: scope, orderBy: { date: 'desc' }, take: 12 }),
      prisma.invoice.findMany({ where: scope }),
      prisma.quote.findMany({ where: scope })
    ]);
    const docLines = docs.map(
      (d) =>
        `${d.supplier} · ${fmt(d.total)} · ${d.category} · estado ${d.status}${d.warn ? ' · ALERTA: ' + d.warn : ''}${d.uuid ? ' · UUID ' + d.uuid.slice(0, 13) + '…' : ''}`
    );
    const invLines = invoices
      .filter((i) => i.status === 'PENDIENTE')
      .map((i) => `${i.clientName} · ${i.folio} · ${fmt(i.amount)} · vence ${i.dueDate.toLocaleDateString('es-MX')}${i.dueDate < new Date() ? ' · VENCIDA' : ''}`);
    const low = quotes.filter((q) => q.margin * 100 < q.floor && q.status !== 'APROBADA');
    const lowLines = low.map((q) => `${q.folio} · ${q.clientName} · margen ${(q.margin * 100).toFixed(0)}% vs piso ${q.floor}% · estado ${q.status}`);
    return [
      `Comprobantes recientes:\n${docLines.join('\n') || 'sin comprobantes'}`,
      `Facturas por cobrar:\n${invLines.join('\n') || 'sin facturas pendientes'}`,
      `Cotizaciones bajo piso:\n${lowLines.join('\n') || 'ninguna'}`
    ].join('\n\n');
  }

  if (agent === 'comercial') {
    const [leads, quotes] = await Promise.all([
      prisma.lead.findMany({ where: scope, orderBy: { daysInStage: 'desc' }, take: 12 }),
      prisma.quote.findMany({ where: scope, orderBy: { createdAt: 'asc' } })
    ]);
    const leadLines = leads.map(
      (l) => `${l.company} · etapa ${l.stage} · ${l.daysInStage} días · ${l.amount ? fmt(l.amount) : 'sin monto'} · siguiente: ${l.nextAction || '—'} · fuente ${l.source}`
    );
    const stale = quotes.filter((q) => q.status === 'ENVIADA' && Date.now() - q.createdAt.getTime() > 14 * 86400000);
    const staleLines = stale.map((q) => `${q.folio} · ${q.clientName} · ${fmt(q.total)} · enviada hace ${Math.round((Date.now() - q.createdAt.getTime()) / 86400000)} días`);
    return [`Leads:\n${leadLines.join('\n') || 'sin leads'}`, `Cotizaciones sin respuesta (+14 días):\n${staleLines.join('\n') || 'ninguna'}`].join(
      '\n\n'
    );
  }

  if (agent === 'tecnico') {
    const quotes = await prisma.quote.findMany({ where: scope, orderBy: { createdAt: 'desc' }, take: 10 });
    const systems = await prisma.system.findMany();
    const lines = quotes.map((q) => {
      const key = q.selected === 'A' ? q.optA : q.optB;
      const s = systems.find((x) => x.key === key);
      return `${q.folio} · ${q.clientName} · ${s?.short || key} · garantía ${s?.warranty}a · área ${q.areaDev.toFixed(0)} m² · ${q.verified ? 'área verificada' : 'sin verificar'} · costos ${q.costsDocumented ? 'documentados' : 'SIN documentar'} · margen ${(q.margin * 100).toFixed(0)}%`;
    });
    return `Cotizaciones:\n${lines.join('\n') || 'sin cotizaciones'}`;
  }

  if (agent === 'compras') {
    const items = await prisma.inventoryItem.findMany({ orderBy: { name: 'asc' } });
    const lines = items.map(
      (i) =>
        `${i.name} · stock ${i.stock} ${i.unitName} · mínimo ${i.min} · costo ${fmt(i.cost)} · proveedor ${i.provider}${i.stock < i.min ? ' · BAJO MÍNIMO (pedido sugerido ' + Math.max(i.min * 2 - i.stock, 0) + ')' : ''}`
    );
    return `Inventario:\n${lines.join('\n')}`;
  }

  const tenders = await prisma.tender.findMany({ where: scope, orderBy: { openingDate: 'asc' } });
  const lines = tenders.map(
    (t) => `${t.convener} · ${t.object} · apertura ${t.openingDate.toLocaleDateString('es-MX')} · match ${t.match}% · estado ${t.status}`
  );
  return `Licitaciones:\n${lines.join('\n') || 'sin licitaciones registradas'}`;
}

function fallbackSummary(agent: AgentKey, context: string) {
  return `No pude conectar con la IA en este momento. Resumen de lo que veo:\n\n${context}\n\nRevisa el módulo correspondiente. La IA sugiere, el humano aprueba.`;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  let payload: { agent?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const agent = payload.agent as AgentKey;
  if (!agent || !LABELS[agent]) return NextResponse.json({ error: 'Agente inválido' }, { status: 400 });

  const user: SessionUser = {
    id: session.user.id,
    name: session.user.name || '',
    email: session.user.email || '',
    role: session.user.role,
    unitId: session.user.unitId ?? null
  };
  const unitId = await getActiveUnitId(user);

  let context = '';
  try {
    context = await buildContext(agent, unitId);
  } catch {
    context = 'Contexto no disponible por un error de base de datos.';
  }

  const system = [
    `Eres el ${LABELS[agent]} de IMPERTODO AI OS, plataforma de impermeabilización en Torreón, México.`,
    ROLES[agent],
    'Trabaja en español, en texto plano (sin markdown), máximo 140 palabras.',
    'Usa solo los datos del contexto; no inventes cifras. Si faltan datos, dilo.',
    'Entrega 3 a 5 recomendaciones accionables, concretas y priorizadas.',
    'La IA sugiere, el humano aprueba: no ejecutes acciones, no envíes, no pagues, no contabilices.',
    'Nunca recomiendes autorizar documentos con alerta (sin CFDI, 69-B, datos incompletos): recomienda revisión, corrección o rechazo.',
    'Módulos: Hoy, Cotizar, Clientes & Techos, Propuesta viva, Captación, Obra / OT, Inventario, Caja / Contabilidad, Cobrar, Aprobaciones, Licitaciones, Franquicias, Central (red), Catálogo / Precios, Agentes IA, Notificaciones.'
  ].join('\n');

  const cacheKey = `${agent}:${unitId ?? 'all'}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return NextResponse.json({ reply: hit.reply, mode: 'gemini', reason: 'cache', agent });
  }

  const result = await askGemini(system, `CONTEXTO ACTUAL:\n${context}\n\nGenera tu análisis y recomendaciones para hoy.`, 900);

  if (result.text) cache.set(cacheKey, { at: Date.now(), reply: result.text });

  return NextResponse.json({
    reply: result.text || fallbackSummary(agent, context),
    mode: result.mode,
    reason: result.reason,
    agent
  });
}
