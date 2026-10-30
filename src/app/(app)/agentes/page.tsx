import { prisma } from '@/lib/prisma';
import { requireUser, getActiveUnitId } from '@/lib/session';
import { fmt, dateStr } from '@/lib/constants';

export default async function AgentesPage() {
  const user = await requireUser();
  const unitId = await getActiveUnitId(user);
  const scope = unitId ? { unitId } : {};

  const [quotes, docs, inventory, tenders, audit, events] = await Promise.all([
    prisma.quote.findMany({ where: scope }),
    prisma.doc.findMany({ where: scope }),
    prisma.inventoryItem.findMany(),
    prisma.tender.findMany({ where: scope, orderBy: { openingDate: 'asc' } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 8 }),
    prisma.businessEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 6 })
  ]);

  const lowMargin = quotes.filter((q) => q.margin * 100 < q.floor && q.status !== 'APROBADA');
  const pendingDocs = docs.filter((d) => d.status === 'PENDIENTE' || d.status === 'REVISADO');
  const flaggedDocs = docs.filter((d) => Boolean(d.warn));
  const staleQuotes = quotes.filter((q) => q.status === 'ENVIADA' && Date.now() - q.createdAt.getTime() > 14 * 86400000);
  const lowStock = inventory.filter((i) => i.stock < i.min);

  const findings = [
    ...staleQuotes.map((q) => ({ kind: 'warn', text: `Cotización ${q.folio} · ${q.clientName} sin respuesta hace más de 14 días. Sugerido: seguimiento con comparativo $/m²/año.` })),
    ...lowMargin.map((q) => ({ kind: 'bad', text: `Margen bajo piso en ${q.folio} (${(q.margin * 100).toFixed(0)}% vs ${q.floor}%). Requiere autorización de gerencia.` })),
    ...flaggedDocs.map((d) => ({ kind: 'bad', text: `Documento con alerta: ${d.supplier} — ${d.warn}. Revisión obligatoria.` })),
    ...(pendingDocs.length ? [{ kind: 'info', text: `${pendingDocs.length} comprobantes en bandeja. Los de confianza ≥90% sin alerta pueden revisarse en lote.` }] : []),
    ...lowStock.map((i) => ({ kind: 'warn', text: `Stock bajo: ${i.name} (${i.stock}/${i.min}). Pedido sugerido disponible.` })),
    ...tenders.slice(0, 1).map((t) => ({ kind: 'info', text: `Licitación ${t.convener} con match ${t.match}% · apertura ${dateStr(t.openingDate)}.` }))
  ];

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">Copiloto discreto</div>
          <h1>Agentes de IA</h1>
          <div className="sub">Trabajan con reglas sobre tus datos reales. Sugieren; el humano aprueba. Nunca envían, pagan ni contabilizan solos.</div>
        </div>
      </div>

      <div className="grid-3">
        <div className="agent">
          <span className="ic">📄</span>
          <div className="t">
            <b>Agente de documentos</b> — lee XML, detecta duplicados por UUID y clasifica borradores. <span className="badge warn">No contabiliza</span>
          </div>
        </div>
        <div className="agent">
          <span className="ic">💬</span>
          <div className="t">
            <b>Agente comercial</b> — detecta cotizaciones sin respuesta y sugiere seguimiento. <span className="badge warn">No envía solo</span>
          </div>
        </div>
        <div className="agent">
          <span className="ic">🔧</span>
          <div className="t">
            <b>Agente técnico</b> — valida espesores, fichas y coherencia del procedimiento. <span className="badge warn">No autoriza</span>
          </div>
        </div>
        <div className="agent">
          <span className="ic">💰</span>
          <div className="t">
            <b>Agente financiero</b> — margen bajo piso, gastos anómalos, 69-B. <span className="badge warn">No paga</span>
          </div>
        </div>
        <div className="agent">
          <span className="ic">🛒</span>
          <div className="t">
            <b>Agente de compras</b> — reposición bajo mínimo y comparación de costo instalado. <span className="badge warn">No compra</span>
          </div>
        </div>
        <div className="agent">
          <span className="ic">🏛️</span>
          <div className="t">
            <b>Agente de licitaciones</b> — puntúa coincidencia con experiencia y certificaciones. <span className="badge warn">No envía</span>
          </div>
        </div>
      </div>

      <div className="two" style={{ marginTop: 14 }}>
        <div className="card panel">
          <div className="sec">
            Revisión IA <span className="badge">{findings.length} hallazgos</span>
          </div>
          {findings.length === 0 && <div className="alert g">Sin hallazgos. Operación al día.</div>}
          {findings.map((f, i) => (
            <div className={`alert ${f.kind === 'bad' ? 'r' : f.kind === 'warn' ? 'y' : 'b'}`} key={i}>
              {f.text}
            </div>
          ))}
        </div>

        <div className="stack">
          <div className="card panel">
            <div className="sec">Bitácora IA / auditoría</div>
            {audit.map((a) => (
              <div className="rule" key={a.id}>
                <span className="ic info">i</span>
                <div>
                  <b>{a.action}</b> {a.ref ? `· ${a.ref}` : ''}
                  <div className="mini">
                    {a.createdAt.toLocaleString('es-MX')} · {a.role || 'sistema'}
                  </div>
                </div>
              </div>
            ))}
            {!audit.length && <div className="mini">Sin registros.</div>}
          </div>
          <div className="card panel">
            <div className="sec">Eventos de negocio recientes</div>
            {events.map((ev) => (
              <div className="rule" key={ev.id}>
                <span className={`ic ${ev.type === 'FRANCHISE_ACQUIRED' ? 'ok' : ev.type === 'ROYALTY_CALCULATED' ? 'info' : 'warn'}`}>•</span>
                <div>
                  <b>{ev.title}</b>
                  <div className="mini">{ev.description}</div>
                </div>
              </div>
            ))}
            {!events.length && <div className="mini">Sin eventos.</div>}
          </div>
          <div className="card panel">
            <div className="sec">Costo del copiloto</div>
            <div className="mini">
              Modo actual: reglas deterministas sobre la base de datos (costo $0). La conexión a una API de IA real es opcional vía variable de entorno y queda auditada por llamada.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
