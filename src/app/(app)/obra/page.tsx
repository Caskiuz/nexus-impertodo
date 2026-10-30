import { prisma } from '@/lib/prisma';
import { requireUser, getActiveUnitId } from '@/lib/session';
import { fmt, dateStr } from '@/lib/constants';
import { markPhaseAction, setRealMaterialAction, deliverAction } from './actions';

const PHASES_BY_UNIT: Record<string, string[]> = {
  L: ['Limpieza e hidrolavado', 'Sellador / primer', 'Sellado de grietas y detalles', '1ª capa', 'Membrana de refuerzo', '2ª capa y entrega'],
  m2: ['Limpieza', 'Primer asfáltico', 'Sellado de puntos críticos', 'Colocación de rollo por termofusión', 'Resoldar traslapes', 'Perímetro: cemento plástico', 'Acabado y entrega'],
  kg: ['Preparación de superficie', 'Primer', 'Aplicación', 'Acabado y entrega']
};

export default async function ObraPage({ searchParams }: { searchParams: Promise<{ ot?: string; msg?: string; err?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const unitId = await getActiveUnitId(user);
  const scope = unitId ? { unitId } : {};
  const ots = await prisma.oT.findMany({ where: scope, orderBy: { createdAt: 'desc' }, include: { photos: true } });
  const selected = sp.ot ? ots.find((o) => o.code === sp.ot) || ots[0] : ots[0];

  const sys = selected ? await prisma.system.findUnique({ where: { key: selected.systemKey } }) : null;
  const phases = sys ? PHASES_BY_UNIT[sys.unit] || PHASES_BY_UNIT.kg : PHASES_BY_UNIT.kg;
  const done = selected ? Math.min(selected.phasesDone, phases.length) : 0;
  const pct = selected ? Math.round((done / phases.length) * 100) : 0;
  const mermaDelta = selected && selected.matTheo > 0 ? ((selected.matReal - selected.matTheo) / selected.matTheo) * 100 : 0;

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">Ejecución</div>
          <h1>Obra / Órdenes de Trabajo</h1>
          <div className="sub">Regla de 60 segundos: foto + fase + m² y listo. La OT nace al aprobar una cotización.</div>
        </div>
        <div className="actions">
          {ots.map((o) => (
            <a key={o.id} className={`btn sm ${selected?.id === o.id ? 'azul' : ''}`} href={`/obra?ot=${o.code}`}>
              {o.code}
            </a>
          ))}
        </div>
      </div>
      {sp.msg === 'fase' && <div className="alert g">Fase registrada con evidencia fotográfica y consumo teórico descontado.</div>}
      {sp.msg === 'entregada' && <div className="alert g">Obra entregada: garantía digital emitida y expediente cerrado.</div>}
      {sp.err === 'fases' && <div className="alert r">No se puede entregar: faltan fases por completar.</div>}

      {!selected ? (
        <div className="alert y">No hay órdenes de trabajo. Aprueba una cotización para generarlas.</div>
      ) : (
        <div className="grid-2">
          <div className="stack">
            <div className="card panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <div className="eyebrow">{selected.code} · {sys?.short || selected.systemKey}</div>
                  <h3 style={{ fontSize: 17, color: 'var(--azul-700)' }}>{selected.clientName}</h3>
                  <div className="mini">
                    {selected.area.toLocaleString('es-MX')} m² · supervisor {selected.supervisor} · cuadrilla {selected.crew} · inicio {dateStr(selected.createdAt)}
                  </div>
                </div>
                <span className={`badge ${selected.status === 'ENTREGADA' ? 'ok' : selected.status === 'DETENIDA' ? 'bad' : 'warn'}`}>{selected.status}</span>
              </div>
              <div className="row4" style={{ marginTop: 12 }}>
                <div className="area-box">
                  <div className="eyebrow">Avance</div>
                  <div className="big">{pct}%</div>
                </div>
                <div className="area-box">
                  <div className="eyebrow">Fases</div>
                  <div className="big">{done}/{phases.length}</div>
                </div>
                <div className="area-box">
                  <div className="eyebrow">Material real</div>
                  <div className="big" style={{ color: mermaDelta > 2 ? 'var(--rojo)' : 'var(--verde-600)' }}>
                    {selected.matReal}/{selected.matTheo}
                  </div>
                </div>
                <div className="area-box">
                  <div className="eyebrow">Merma</div>
                  <div className="big" style={{ color: mermaDelta > 2 ? 'var(--rojo)' : 'var(--verde-600)' }}>
                    {mermaDelta > 0 ? '+' : ''}{mermaDelta.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>

            <div className="card panel">
              <div className="sec">Fases y evidencia</div>
              {phases.map((f, i) => {
                const isDone = i < selected.phasesDone;
                return (
                  <div className={`rule`} key={f} style={isDone ? { background: 'var(--verde-50)', borderRadius: 8, paddingInline: 8 } : {}}>
                    <span className={`ic ${isDone ? 'ok' : 'info'}`}>{isDone ? '✓' : i + 1}</span>
                    <div style={{ flex: 1 }}>
                      <b>{f}</b>
                      <div className="mini">{isDone ? 'Foto geolocalizada · revisada por IA' : 'Pendiente'}</div>
                    </div>
                    {!isDone && (
                      <form action={markPhaseAction}>
                        <input type="hidden" name="otId" value={selected.id} />
                        <button className="btn sm primary" type="submit">
                          📷 Foto + listo
                        </button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="card panel">
              <div className="sec">Entrega y firma</div>
              <div className="mini" style={{ marginBottom: 8 }}>Firma del cliente en pantalla → genera garantía digital. El CFDI de finiquito se timbra fuera del sistema.</div>
              <div style={{ border: '1.5px dashed var(--linea)', borderRadius: 9, height: 90, display: 'grid', placeItems: 'center', color: 'var(--gris)', fontSize: 12, background: '#fcfcfd' }}>
                ✍️ Firma del cliente registrada en pantalla (demo)
              </div>
              <form action={deliverAction} style={{ marginTop: 8 }}>
                <input type="hidden" name="otId" value={selected.id} />
                <button className="btn primary" type="submit" disabled={selected.status === 'ENTREGADA'}>
                  Entregar y generar garantía
                </button>
              </form>
            </div>
          </div>

          <div className="stack">
            <div className="card panel">
              <div className="sec">Material teórico vs real</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="mini">
                  {selected.matReal > selected.matTheo ? (
                    <span className="badge bad">+{selected.matReal - selected.matTheo} sobre lo teórico</span>
                  ) : (
                    <span className="badge ok">Dentro de lo teórico</span>
                  )}
                </div>
              </div>
              <div className="sumline">
                <span>Teórico ({sys?.short})</span>
                <b>{selected.matTheo}</b>
              </div>
              <form action={setRealMaterialAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 8 }}>
                <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                  <label>Consumo real</label>
                  <input type="number" name="matReal" defaultValue={selected.matReal} />
                </div>
                <input type="hidden" name="otId" value={selected.id} />
                <button className="btn sm" type="submit">
                  Actualizar
                </button>
              </form>
              <div className="sumline" style={{ marginTop: 8 }}>
                <span>Destajo avanzado (m²)</span>
                <b>{selected.laborReal}</b>
              </div>
            </div>

            <div className="card panel">
              <div className="sec">Calidad IA</div>
              {selected.photos.length === 0 && <div className="alert b">Sin fotos todavía. Cada fase pide evidencia.</div>}
              {selected.photos.slice(0, 5).map((p) => (
                <div className="rule" key={p.id}>
                  <span className="ic info">i</span>
                  <div>
                    <b>Fase {p.phase}</b> · {p.label}
                    <div className="mini">{dateStr(p.createdAt)}</div>
                  </div>
                </div>
              ))}
              <div className="alert y" style={{ marginTop: 8 }}>
                Foto simulada: traslape insuficiente en junta → validar con supervisor antes de cerrar la fase.
              </div>
            </div>

            <div className="card panel">
              <div className="sec">Clima en obra</div>
              <div className="wk">
                <div className="g">V<b>31°</b></div>
                <div className="g">S<b>30°</b></div>
                <div className="y">D<b>27°</b></div>
                <div className="r">L<b>24°</b></div>
                <div className="r">M<b>23°</b></div>
                <div className="g">X<b>28°</b></div>
                <div className="g">J<b>30°</b></div>
              </div>
              <div className="mini" style={{ marginTop: 8 }}>Lunes–martes sin aplicación: el agente propone reprogramar y avisa al cliente.</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
