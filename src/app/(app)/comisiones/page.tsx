import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import { fmt } from '@/lib/constants';
import { markCommissionCollectedAction, updateCommissionRateAction } from './actions';

export default async function ComisionesPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;

  if (user.role !== 'DEV') {
    return (
      <>
        <div className="head">
          <div>
            <div className="eyebrow">Panel del desarrollador</div>
            <h1>Mi comisión 20%</h1>
            <div className="sub">Acceso restringido al rol Desarrollador (dev@nexus.mx).</div>
          </div>
        </div>
        <div className="alert y">
          Este panel es privado del desarrollador. Inicia sesión con <b>dev@nexus.mx</b> / <b>nexus2026</b> para ver el libro de comisiones y los eventos de la red.
        </div>
      </>
    );
  }

  const [config, entries, events, units] = await Promise.all([
    prisma.commissionConfig.findUnique({ where: { id: 'default' } }),
    prisma.commissionEntry.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.businessEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 40 }),
    prisma.unit.findMany()
  ]);

  const eventById = new Map(events.map((e) => [e.id, e]));
  const unitName = (id: string | null) => (id ? units.find((u) => u.id === id)?.name || '—' : 'Red');
  const accrued = entries.reduce((x, e) => x + e.amount, 0);
  const collected = entries.filter((e) => e.status === 'COBRADA').reduce((x, e) => x + e.amount, 0);
  const pending = accrued - collected;
  const base = entries.reduce((x, e) => x + e.baseAmount, 0);
  const rate = config?.rate ?? 0.2;

  const byUnit = new Map<string, { base: number; commission: number; pending: number }>();
  for (const e of entries) {
    const key = e.unitId || 'red';
    const acc = byUnit.get(key) || { base: 0, commission: 0, pending: 0 };
    acc.base += e.baseAmount;
    acc.commission += e.amount;
    if (e.status !== 'COBRADA') acc.pending += e.amount;
    byUnit.set(key, acc);
  }

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">Panel del desarrollador · Nexus</div>
          <h1>Mi comisión 20%</h1>
          <div className="sub">Libro mayor automático de la red: cuota de franquicia, regalías 6%+2%, fee tecnológico y producto. Sin pasarela: el cobro se marca manualmente.</div>
        </div>
      </div>
      {sp.msg === 'cobrada' && <div className="alert g">Comisión marcada como cobrada. Persiste en el historial.</div>}
      {sp.msg === 'tasa' && <div className="alert g">Tasa actualizada. Aplica a eventos futuros.</div>}

      <div className="grid-4" style={{ marginBottom: 14 }}>
        <div className="card kpi">
          <div className="lbl">Comisión devengada</div>
          <div className="val">{fmt(accrued)}</div>
          <div className="d">sobre base {fmt(base)}</div>
        </div>
        <div className="card kpi">
          <div className="lbl">Cobrada</div>
          <div className="val" style={{ color: 'var(--verde)' }}>{fmt(collected)}</div>
          <div className="d">{entries.filter((e) => e.status === 'COBRADA').length} asientos</div>
        </div>
        <div className="card kpi">
          <div className="lbl">Pendiente de cobro</div>
          <div className="val" style={{ color: 'var(--naranja)' }}>{fmt(pending)}</div>
          <div className="d">por asegurar</div>
        </div>
        <div className="card kpi">
          <div className="lbl">Tasa vigente</div>
          <div className="val">{(rate * 100).toFixed(0)}%</div>
          <div className="d">configurable</div>
        </div>
      </div>

      <div className="two">
        <div className="card tbl">
          <div className="sec" style={{ padding: '14px 14px 0' }}>Libro de comisiones</div>
          <table>
            <thead>
              <tr>
                <th>Evento</th>
                <th>Unidad</th>
                <th className="num">Base</th>
                <th className="num">Comisión</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const ev = eventById.get(e.eventId);
                return (
                  <tr key={e.id}>
                    <td>
                      <b>{ev?.title || 'Evento'}</b>
                      <div className="mini">{ev?.description || ''}</div>
                    </td>
                    <td>{unitName(e.unitId)}</td>
                    <td className="num">{fmt(e.baseAmount)}</td>
                    <td className="num monto">{fmt(e.amount)}</td>
                    <td>
                      <span className={`badge ${e.status === 'COBRADA' ? 'ok' : 'warn'}`}>{e.status}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {e.status !== 'COBRADA' && (
                        <form action={markCommissionCollectedAction}>
                          <input type="hidden" name="entryId" value={e.id} />
                          <button className="btn sm primary" type="submit">
                            Marcar cobrada
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!entries.length && (
                <tr>
                  <td colSpan={6} className="mini">
                    Aún no hay comisiones. Registra una franquicia, venta, regalía o pedido.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="stack">
          <form action={updateCommissionRateAction} className="card panel">
            <div className="sec">Configuración del acuerdo</div>
            <div className="field">
              <label>Comisión del desarrollador (%)</label>
              <input name="rate" type="number" min={1} max={50} step="0.5" defaultValue={(rate * 100).toFixed(1)} />
            </div>
            <div className="mini" style={{ marginBottom: 8 }}>
              Aplica a: cuota de franquicia, regalías, fee tecnológico y pedidos de producto. Las ventas timbradas alimentan la regalía (no se comisionan dos veces).
            </div>
            <button className="btn primary" type="submit">
              Guardar tasa
            </button>
          </form>

          <div className="card tbl">
            <div className="sec" style={{ padding: '14px 14px 0' }}>Por unidad</div>
            <table>
              <thead>
                <tr>
                  <th>Unidad</th>
                  <th className="num">Base</th>
                  <th className="num">Comisión</th>
                  <th className="num">Pendiente</th>
                </tr>
              </thead>
              <tbody>
                {[...byUnit.entries()].map(([key, v]) => (
                  <tr key={key}>
                    <td>{key === 'red' ? 'Red (sin unidad)' : unitName(key)}</td>
                    <td className="num">{fmt(v.base)}</td>
                    <td className="num monto">{fmt(v.commission)}</td>
                    <td className="num">{fmt(v.pending)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card panel">
            <div className="sec">Cómo se asegura tu 20%</div>
            <div className="rule">
              <span className="ic ok">✓</span>
              <div>Cada venta o adquisición crea un <b>evento inmutable</b> con monto y unidad; el motor calcula la comisión en el mismo instante.</div>
            </div>
            <div className="rule">
              <span className="ic info">i</span>
              <div>El aviso queda en la bandeja interna con campana y contador (canal elegido). Sin email ni WhatsApp por ahora.</div>
            </div>
            <div className="rule">
              <span className="ic warn">!</span>
              <div>El cobro es manual mientras no exista pasarela de pagos: marca “cobrada” cuando recibas el importe.</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
