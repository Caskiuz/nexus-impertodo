import { prisma } from '@/lib/prisma';
import { requireUser, getActiveUnitId } from '@/lib/session';
import { fmt } from '@/lib/constants';
import { approveQuoteAction } from '@/actions/quotes';
import { reviewDocAction, authorizeDocAction, rejectDocAction } from '@/actions/docs';

export default async function AprobacionesPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const unitId = await getActiveUnitId(user);
  const scope = unitId ? { unitId } : {};

  const [quotes, docs] = await Promise.all([
    prisma.quote.findMany({ where: scope, orderBy: { createdAt: 'asc' }, include: { extras: true } }),
    prisma.doc.findMany({ where: scope, orderBy: { date: 'asc' } })
  ]);

  const pendingQuotes = quotes.filter((q) => !(q.approvalsAdmin && q.approvalsGerencia) && q.status !== 'RECHAZADA');
  const pendingDocs = docs.filter((d) => !(d.adminOk && d.gerenciaOk) && d.status !== 'RECHAZADO');

  const messages: Record<string, string> = {
    'admin-ok': 'Revisión de Administración registrada. Falta la autorización de Gerencia.',
    aprobada: 'Cotización aprobada: se generó la OT y se reservaron materiales.',
    revisado: 'Comprobante revisado por Administración.',
    autorizado: 'Comprobante autorizado por Gerencia. Listo para que el contador lo registre en el ERP.',
    rechazado: 'Comprobante rechazado.'
  };
  const errors: Record<string, string> = {
    costos: 'Bloqueado: falta evidencia documental de costos y ficha técnica.',
    'admin-primero': 'Primero debe revisar Administración.',
    rol: 'Tu rol no puede ejecutar esta aprobación.',
    noexiste: 'El registro ya no existe.'
  };

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">Gerencia + administración</div>
          <h1>Aprobaciones</h1>
          <div className="sub">Una captura, dos revisiones. Administración verifica; gerencia autoriza; el contador registra en el ERP.</div>
        </div>
      </div>
      {sp.msg && <div className="alert g">{messages[sp.msg] || 'Listo.'}</div>}
      {sp.err && <div className="alert r">{errors[sp.err] || 'Acción no permitida.'}</div>}

      <div className="flow" style={{ marginBottom: 15 }}>
        <span>Empleado carga</span>
        <i>→</i>
        <span>Administración revisa</span>
        <i>→</i>
        <span>Gerencia autoriza</span>
        <i>→</i>
        <span>Contador registra en ERP</span>
      </div>

      <div className="grid-2">
        <div className="card panel">
          <div className="sec">
            Cotizaciones pendientes <span className="badge">{pendingQuotes.length}</span>
          </div>
          {pendingQuotes.map((q) => (
            <div className="alert y" key={q.id}>
              <b>
                {q.folio} · {q.clientName}
              </b>{' '}
              — {fmt(q.total)} · margen {(q.margin * 100).toFixed(0)}% (piso {q.floor}%).
              <div className="mini" style={{ marginTop: 2 }}>
                Costos documentados: {q.costsDocumented ? `sí · ${q.catalogSource || 'ficha registrada'}` : 'NO — bloqueado'} · Admin{' '}
                {q.approvalsAdmin ? '✓' : 'pendiente'} · Gerencia {q.approvalsGerencia ? '✓' : 'pendiente'}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {!q.approvalsAdmin && ['ADMIN', 'CENTRAL', 'DEV'].includes(user.role) && (
                  <form action={approveQuoteAction}>
                    <input type="hidden" name="quoteId" value={q.id} />
                    <input type="hidden" name="redirectTo" value="/aprobaciones" />
                    <button className="btn sm" type="submit">
                      Revisión Administración
                    </button>
                  </form>
                )}
                {!q.approvalsAdmin && !['ADMIN', 'CENTRAL', 'DEV'].includes(user.role) && (
                  <span className="badge info">Esperando revisión de Administración</span>
                )}
                {q.approvalsAdmin && !q.approvalsGerencia && ['GERENCIA', 'CENTRAL', 'DEV'].includes(user.role) && (
                  <form action={approveQuoteAction}>
                    <input type="hidden" name="quoteId" value={q.id} />
                    <input type="hidden" name="redirectTo" value="/aprobaciones" />
                    <button className="btn sm primary" type="submit">
                      Autorizar y generar OT
                    </button>
                  </form>
                )}
                {q.approvalsAdmin && !q.approvalsGerencia && !['GERENCIA', 'CENTRAL', 'DEV'].includes(user.role) && (
                  <span className="badge info">Esperando autorización de Gerencia</span>
                )}
              </div>
            </div>
          ))}
          {!pendingQuotes.length && <div className="alert g">Sin cotizaciones pendientes.</div>}
        </div>

        <div className="card panel">
          <div className="sec">
            Comprobantes pendientes <span className="badge">{pendingDocs.length}</span>
          </div>
          {pendingDocs.map((d) => (
            <div className="alert b" key={d.id}>
              <b>
                {d.supplier} · {fmt(d.total)}
              </b>{' '}
              — {d.category} · {d.workRef || 'sin obra'}.
              <div className="mini" style={{ marginTop: 2 }}>
                Admin {d.adminOk ? '✓' : 'pendiente'} · Gerencia {d.gerenciaOk ? '✓' : 'pendiente'}
                {d.warn ? ` · ${d.warn}` : ''}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {!d.adminOk && (
                  <form action={reviewDocAction}>
                    <input type="hidden" name="docId" value={d.id} />
                    <input type="hidden" name="redirectTo" value="/aprobaciones" />
                    <button className="btn sm" type="submit">
                      Revisar
                    </button>
                  </form>
                )}
                {d.adminOk && !d.gerenciaOk && (
                  <form action={authorizeDocAction}>
                    <input type="hidden" name="docId" value={d.id} />
                    <input type="hidden" name="redirectTo" value="/aprobaciones" />
                    <button className="btn sm primary" type="submit">
                      Autorizar
                    </button>
                  </form>
                )}
                <form action={rejectDocAction}>
                  <input type="hidden" name="docId" value={d.id} />
                  <input type="hidden" name="redirectTo" value="/aprobaciones" />
                  <button className="btn sm ghost" type="submit">
                    Rechazar
                  </button>
                </form>
              </div>
            </div>
          ))}
          {!pendingDocs.length && <div className="alert g">Sin comprobantes pendientes.</div>}
        </div>
      </div>
    </>
  );
}
