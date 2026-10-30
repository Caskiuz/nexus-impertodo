import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireUser, getActiveUnitId } from '@/lib/session';
import { fmt, fmt2, GOLDEN_RULES, dateStr } from '@/lib/constants';

export default async function HoyPage() {
  const user = await requireUser();
  const unitId = await getActiveUnitId(user);
  const scope = unitId ? { unitId } : {};

  const [leads, quotes, docs, invoices, ots, settings, inventory, tenders, events] = await Promise.all([
    prisma.lead.findMany({ where: scope }),
    prisma.quote.findMany({ where: scope }),
    prisma.doc.findMany({ where: scope }),
    prisma.invoice.findMany({ where: scope }),
    prisma.oT.findMany({ where: scope }),
    prisma.settings.findUnique({ where: { id: 'default' } }),
    prisma.inventoryItem.findMany(),
    prisma.tender.findMany({ where: scope, orderBy: { openingDate: 'asc' } }),
    prisma.businessEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 4 })
  ]);

  const floor = settings?.floor ?? 30;
  const pipeline = leads.filter((l) => l.stage < 4).reduce((x, l) => x + (l.amount || 0), 0);
  const avgMargin = quotes.length ? quotes.reduce((x, q) => x + q.margin, 0) / quotes.length : 0;
  const docsPending = docs.filter((d) => d.status === 'PENDIENTE' || d.status === 'REVISADO').length;
  const cxc = invoices.filter((i) => i.status === 'PENDIENTE').reduce((x, i) => x + i.amount, 0);
  const overdue = invoices.filter((i) => i.status === 'PENDIENTE' && i.dueDate < new Date());
  const overdueSum = overdue.reduce((x, i) => x + i.amount, 0);
  const lowMargin = quotes.filter((q) => q.margin * 100 < floor && (q.status === 'ENVIADA' || q.status === 'BORRADOR'));
  const stopped = ots.filter((o) => o.status === 'DETENIDA');
  const lowStock = inventory.filter((i) => i.stock < i.min);

  const actions: { kind: 'bad' | 'warn' | 'info' | 'ok'; text: string; href: string; label: string }[] = [];

  for (const q of quotes.filter((q) => q.status === 'ENVIADA').slice(0, 2)) {
    actions.push({
      kind: 'bad',
      text: `${q.clientName} — cotización ${q.folio} (${fmt(q.total)}) en seguimiento. Vigencia 30 días.`,
      href: '/aprobaciones',
      label: 'Ver'
    });
  }
  for (const inv of overdue.slice(0, 2)) {
    actions.push({
      kind: 'bad',
      text: `${inv.clientName} — ${inv.folio} vencida desde ${dateStr(inv.dueDate)} · ${fmt(inv.amount)}`,
      href: '/cobrar',
      label: 'Cobrar'
    });
  }
  if (docsPending) {
    actions.push({
      kind: 'warn',
      text: `${docsPending} comprobantes en bandeja: ${docs.filter((d) => d.status === 'PENDIENTE' && !d.warn).length} listos para revisar, ${docs.filter((d) => d.warn).length} con alerta.`,
      href: '/caja',
      label: 'Revisar'
    });
  }
  for (const o of stopped) {
    actions.push({
      kind: 'warn',
      text: `${o.code} · ${o.clientName} — ${o.status.toLowerCase()}. Revisar material o inventario.`,
      href: '/obra',
      label: 'Ver OT'
    });
  }
  for (const q of lowMargin) {
    actions.push({
      kind: 'warn',
      text: `Cot. ${q.folio} · ${q.clientName} — margen ${(q.margin * 100).toFixed(0)}% bajo piso ${floor}%. Requiere autorización.`,
      href: '/aprobaciones',
      label: 'Autorizar'
    });
  }
  if (lowStock.length) {
    actions.push({
      kind: 'warn',
      text: `${lowStock.length} productos bajo mínimo: ${lowStock.map((i) => i.name.split(' ').slice(0, 3).join(' ')).join(', ')}.`,
      href: '/inventario',
      label: 'Pedir'
    });
  }
  if (tenders[0]) {
    actions.push({
      kind: 'info',
      text: `Licitación ${tenders[0].convener} — apertura ${dateStr(tenders[0].openingDate)}, coincidencia ${tenders[0].match}%.`,
      href: '/licitaciones',
      label: 'Ver'
    });
  }
  for (const ev of events.filter((e) => e.type === 'FRANCHISE_ACQUIRED' || e.type === 'ROYALTY_CALCULATED').slice(0, 1)) {
    actions.push({ kind: 'info', text: `${ev.title} — ${ev.description}`, href: '/comisiones', label: 'Comisión' });
  }
  actions.push({
    kind: 'ok',
    text: 'OXXO Región Laguna — 3 sucursales cumplen año 1 de garantía en noviembre → visitas de mantenimiento.',
    href: '/clientes',
    label: 'Agendar'
  });

  const weekHeights = [35, 50, 40, 65, 80, 100, 60];

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">Centro operativo</div>
          <h1>Buenos días, {user.role === 'GERENCIA' ? 'Gerencia' : user.role === 'SUPERVISOR' ? 'Supervisor' : user.name} 👋</h1>
          <div className="sub">Lo que mueve dinero hoy, con la IA priorizando y tú decidiendo.</div>
        </div>
        <div className="actions">
          <Link className="btn primary" href="/cotizar">
            + Cotizar obra
          </Link>
          <Link className="btn" href="/agentes">
            🤖 Revisión IA
          </Link>
        </div>
      </div>

      <div className="kpis">
        <div className="card kpi">
          <div className="lbl">Pipeline abierto</div>
          <div className="val">{fmt(pipeline)}</div>
          <div className="d" style={{ color: 'var(--naranja)' }}>
            {leads.filter((l) => l.stage < 4).length} oportunidades activas
          </div>
        </div>
        <div className="card kpi">
          <div className="lbl">Margen promedio</div>
          <div className="val">{(avgMargin * 100).toFixed(0)}%</div>
          <div className="d" style={{ color: avgMargin * 100 < floor ? 'var(--rojo)' : 'var(--verde)' }}>
            piso {floor}%
          </div>
        </div>
        <div className="card kpi">
          <div className="lbl">Comprobantes</div>
          <div className="val">{docsPending}</div>
          <div className="d" style={{ color: 'var(--azul-info)' }}>
            por revisar
          </div>
        </div>
        <div className="card kpi">
          <div className="lbl">Por cobrar</div>
          <div className="val">{fmt(cxc)}</div>
          <div className="d" style={{ color: 'var(--naranja)' }}>
            vencido {fmt2(overdueSum)}
          </div>
        </div>
        <div className="card kpi">
          <div className="lbl">Margen bajo piso</div>
          <div className="val">{lowMargin.length}</div>
          <div className="d" style={{ color: 'var(--rojo)' }}>
            por autorizar
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card panel">
          <div className="sec">
            Atender hoy <span className="badge">IA prioriza · {actions.length} acciones</span>
          </div>
          {actions.slice(0, 8).map((a, i) => (
            <div className={`alert ${a.kind === 'bad' ? 'r' : a.kind === 'warn' ? 'y' : a.kind === 'info' ? 'b' : 'g'}`} key={i}>
              {a.text}
              <div style={{ marginTop: 6 }}>
                <Link className="btn sm" href={a.href}>
                  {a.label}
                </Link>
              </div>
            </div>
          ))}
          {!actions.length && <div className="alert g">Todo al día. Sin acciones pendientes.</div>}
        </div>
        <div>
          <div className="card panel" style={{ marginBottom: 14 }}>
            <div className="sec">Ventana de aplicación · Torreón</div>
            <div className="wk">
              <div className="g">J<b>32°</b>seco</div>
              <div className="g">V<b>31°</b>seco</div>
              <div className="g">S<b>30°</b>seco</div>
              <div className="y">D<b>27°</b>40%</div>
              <div className="r">L<b>24°</b>80%</div>
              <div className="r">M<b>23°</b>70%</div>
              <div className="g">X<b>28°</b>seco</div>
            </div>
            <div className="mini" style={{ marginTop: 8 }}>
              Lunes y martes sin aplicación: el agente propone reprogramar y avisar al cliente.
            </div>
          </div>
          <div className="card panel" style={{ marginBottom: 14 }}>
            <div className="sec">Cotizaciones por semana</div>
            <div className="bars" style={{ margin: '14px 0 24px' }}>
              {weekHeights.map((h, i) => (
                <div key={i} style={{ height: `${h}%` }}>
                  <span>S{37 + i}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card panel">
            <div className="sec">Reglas de oro</div>
            {GOLDEN_RULES.map((r, i) => (
              <div className="rule" key={i}>
                <span className={`ic ${r.kind}`}>{r.kind === 'ok' ? '✓' : r.kind === 'bad' ? '✕' : r.kind === 'info' ? 'i' : '!'}</span>
                <div>{r.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
