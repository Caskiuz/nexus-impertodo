import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getActiveUnitId, isCentralLike, type SessionUser } from '@/lib/session';

const MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';

function fmtMoney(n: number) {
  return '$' + Math.round(n || 0).toLocaleString('es-MX');
}

async function buildContext(user: SessionUser, unitId: string | null) {
  const scope = unitId ? { unitId } : {};
  const [leads, quotes, docs, invoices, inventory, units, royalties, commissions, settings, me] = await Promise.all([
    prisma.lead.findMany({ where: scope, select: { stage: true, amount: true } }),
    prisma.quote.findMany({ where: scope, select: { status: true, margin: true, floor: true, total: true } }),
    prisma.doc.findMany({ where: scope, select: { status: true } }),
    prisma.invoice.findMany({ where: scope, select: { status: true, amount: true, dueDate: true } }),
    prisma.inventoryItem.findMany({ select: { stock: true, min: true, name: true } }),
    prisma.unit.findMany({ select: { name: true, kind: true } }),
    prisma.royaltyPeriod.findMany({ select: { total: true, status: true } }),
    prisma.commissionEntry.findMany({ select: { amount: true, status: true } }),
    prisma.settings.findUnique({ where: { id: 'default' } }),
    prisma.unit.findUnique({ where: { id: unitId ?? user.unitId ?? '__none__' } })
  ]);

  const pipeline = leads.filter((l) => l.stage < 4).reduce((x, l) => x + (l.amount || 0), 0);
  const openLeads = leads.filter((l) => l.stage < 4).length;
  const avgMargin = quotes.length ? quotes.reduce((x, q) => x + q.margin, 0) / quotes.length : 0;
  const pendingQuotes = quotes.filter((q) => q.status === 'BORRADOR' || q.status === 'ENVIADA').length;
  const lowMargin = quotes.filter((q) => q.margin * 100 < q.floor && q.status !== 'APROBADA').length;
  const pendingDocs = docs.filter((d) => d.status === 'PENDIENTE' || d.status === 'REVISADO').length;
  const cxc = invoices.filter((i) => i.status === 'PENDIENTE').reduce((x, i) => x + i.amount, 0);
  const overdue = invoices.filter((i) => i.status === 'PENDIENTE' && i.dueDate < new Date()).reduce((x, i) => x + i.amount, 0);
  const lowStock = inventory.filter((i) => i.stock < i.min);

  const lines = [
    `Fecha: ${new Date().toLocaleDateString('es-MX')}`,
    `Usuario: ${user.name} · rol ${user.role}`,
    `Unidad activa: ${unitId ? me?.name || 'unidad' : 'todas las unidades (vista central)'}`,
    `Catálogo: ${quotes.length} cotizaciones, margen promedio ${(avgMargin * 100).toFixed(0)}%, piso de margen ${settings?.floor ?? 30}%.`,
    `Ventas/CRM: pipeline abierto ${fmtMoney(pipeline)} en ${openLeads} oportunidades; ${pendingQuotes} cotizaciones por aprobar; ${lowMargin} con margen bajo piso.`,
    `Cobranza: ${fmtMoney(cxc)} por cobrar, ${fmtMoney(overdue)} vencido.`,
    `Documentos: ${pendingDocs} comprobantes en bandeja.`,
    `Inventario: ${lowStock.length} productos bajo mínimo${lowStock.length ? ' (' + lowStock.slice(0, 4).map((i) => i.name).join(', ') + ')' : ''}.`,
    `Red: ${units.map((u) => `${u.name} (${u.kind})`).join(', ')}; regalías calculadas ${fmtMoney(royalties.reduce((x, r) => x + r.total, 0))}.`
  ];

  if (user.role === 'DEV') {
    const accrued = commissions.reduce((x, e) => x + e.amount, 0);
    const pending = commissions.filter((e) => e.status !== 'COBRADA').reduce((x, e) => x + e.amount, 0);
    lines.push(`Comisión del desarrollador (20%): ${fmtMoney(accrued)} devengada, ${fmtMoney(pending)} pendiente de cobro.`);
  }

  return lines.join('\n');
}

function fallbackReply(message: string, context: string) {
  const q = message.toLowerCase();
  if (/cobr|debe|adeuda/.test(q)) return 'Revisa el módulo Cobrar para ver facturas, vencidos y registrar recordatorios. La cobranza pendiente está en el contexto del sistema.';
  if (/cotiz|m2|m²|precio/.test(q)) return 'Abre Cotizar: el wizard calcula área desarrollada, costos, margen contra el piso y valida antes de enviar. También puedes usar la barra de comandos.';
  if (/franquicia|regal|red/.test(q)) return 'En Franquicias están las unidades y reglas de red; en Central se registran ventas timbradas, regalías 6%+2% y fees. La comisión del desarrollador se registra automáticamente.';
  if (/factura|gasto|cfdi|xml/.test(q)) return 'En Caja puedes capturar gastos o subir XML CFDI; los UUID duplicados se bloquean y requiere dos revisiones humanas.';
  if (/obra|ot|fase/.test(q)) return 'En Obra/OT avanzas fases con evidencia, controlas consumo teórico vs real y entregas con garantía digital.';
  return 'No tengo la IA conectada en este momento. Puedo guiarte: Hoy, Cotizar, Propuesta viva, Obra, Caja, Cobrar, Franquicias, Central y Catálogo.';
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let payload: { message?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const message = String(payload.message || '').trim();
  if (!message) return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 });
  if (message.length > 700) return NextResponse.json({ error: 'Mensaje demasiado largo' }, { status: 400 });

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
    context = await buildContext(user, unitId);
  } catch (e) {
    context = 'Contexto no disponible (error de base de datos).';
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json({ reply: fallbackReply(message, context), mode: 'fallback' });
  }

  const system = [
    'Eres el asistente de IMPERTODO AI OS, plataforma de impermeabilización (Torreón, México).',
    'Responde en español, breve (máximo 130 palabras), directo y útil.',
    'Usa SOLO las cifras del contexto; no inventes datos ni prometas acciones.',
    'Guía al usuario al módulo correcto de la app. La IA sugiere, el humano aprueba.',
    'No hay pagos en línea, ni timbrado fiscal, ni envíos automáticos.',
    'No uses markdown: ni asteriscos, ni numerales, ni tablas. Texto plano con viñetas simples si hace falta.',
    'Módulos exactos de la app: Hoy; Cotizar; Clientes & Techos; Propuesta viva; Marketing / Captación; Obra / OT; Inventario; Caja / Contabilidad; Cobrar; Aprobaciones; Licitaciones; Franquicias; Central (red); Catálogo / Precios; Agentes IA; Notificaciones; Mi comisión 20% (solo desarrollador).',
    'Para autorizar cotizaciones o comprobantes, el módulo es Aprobaciones (no Propuesta viva). Propuesta viva es solo el enlace que ve el cliente.',
    'Reglas del negocio: regalía 6% + marketing 2% sobre ventas timbradas; fee tecnológico $2,500/mes por unidad; comisión del desarrollador 20% sobre la red; compra exclusiva PROSEALMASTER.',
    '',
    'CONTEXTO ACTUAL:',
    context
  ].join('\n');

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${system}\n\nPREGUNTA DEL USUARIO:\n${message}` }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 900,
            thinkingConfig: { thinkingBudget: 0 }
          }
        })
      }
    );

    if (!res.ok) {
      if (res.status === 429) {
        return NextResponse.json({
          reply: 'La IA está ocupada por un momento. Mientras tanto: ' + fallbackReply(message, context),
          mode: 'fallback'
        });
      }
      return NextResponse.json({ reply: fallbackReply(message, context), mode: 'fallback' });
    }

    const json = await res.json();
    const parts = json.candidates?.[0]?.content?.parts || [];
    const text = parts
      .filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought)
      .map((p: { text: string }) => p.text)
      .join('')
      .trim();

    const clean = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/`{1,3}/g, '')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^\s*[*-]\s+/gm, '• ')
      .trim();

    return NextResponse.json({ reply: clean || fallbackReply(message, context), mode: clean ? 'gemini' : 'fallback' });
  } catch {
    return NextResponse.json({ reply: fallbackReply(message, context), mode: 'fallback' });
  }
}
