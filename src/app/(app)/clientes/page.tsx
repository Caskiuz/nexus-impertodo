import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireUser, getActiveUnitId } from '@/lib/session';
import { advanceLeadAction, createLeadAction } from './actions';
import { STAGES, fmt } from '@/lib/constants';

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const unitId = await getActiveUnitId(user);
  const scope = unitId ? { unitId } : {};

  const [leads, clients] = await Promise.all([
    prisma.lead.findMany({ where: scope, orderBy: { daysInStage: 'desc' } }),
    prisma.client.findMany({ where: scope, include: { assets: true, quotes: true }, orderBy: { name: 'asc' } })
  ]);

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">Cuentas y activos</div>
          <h1>Cada techo es un activo</h1>
          <div className="sub">Historial, garantía y próxima renovación por techo → ingresos recurrentes sin volver a prospectar.</div>
        </div>
      </div>
      {params.msg === 'creado' && <div className="alert g">Prospecto creado. Lo demás se llena al cotizar.</div>}
      {params.err && <div className="alert r">Completa al menos la empresa.</div>}

      <details className="card panel" style={{ marginBottom: 15 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 800, color: 'var(--azul-700)' }}>+ Prospecto (20 segundos)</summary>
        <form action={createLeadAction} style={{ marginTop: 12 }}>
          <div className="row3">
            <div className="field">
              <label>Empresa / cliente</label>
              <input name="company" required placeholder="Ej. Plaza Independencia" />
            </div>
            <div className="field">
              <label>Contacto</label>
              <input name="contact" />
            </div>
            <div className="field">
              <label>WhatsApp</label>
              <input name="phone" />
            </div>
            <div className="field">
              <label>Sector</label>
              <select name="sector">
                <option>Comercial</option>
                <option>Industrial</option>
                <option>Gobierno / Salud</option>
                <option>Residencial</option>
                <option>Minero</option>
              </select>
            </div>
            <div className="field">
              <label>m² aprox.</label>
              <input name="area" type="number" defaultValue={300} />
            </div>
            <div className="field">
              <label>Importe preliminar (MXN)</label>
              <input name="amount" type="number" defaultValue={0} />
            </div>
            <div className="field">
              <label>Obra</label>
              <input name="project" />
            </div>
            <div className="field">
              <label>Dirección</label>
              <input name="address" />
            </div>
            <div className="field">
              <label>Fuente</label>
              <select name="source">
                <option>Referido</option>
                <option>WhatsApp</option>
                <option>Estimador web</option>
                <option>Licitación</option>
                <option>Radar de techos</option>
              </select>
            </div>
          </div>
          <button className="btn primary" type="submit">
            Crear prospecto
          </button>
        </form>
      </details>

      <div className="kanban">
        {STAGES.map((stage, i) => {
          const items = leads.filter((l) => l.stage === i);
          return (
            <div className="kcol" key={stage}>
              <div className="kcol-head">
                {stage} <span className="badge">{items.length}</span>
              </div>
              <div className="kcol-body">
                {items.map((l) => (
                  <div className={`kcard ${l.heat}`} key={l.id}>
                    <div className="t">{l.company}</div>
                    <div className="m">
                      {l.project} · {l.area ? `${l.area.toLocaleString('es-MX')} m²` : 'm² por medir'}
                    </div>
                    <div className="amt">{l.amount ? fmt(l.amount) : 'por cotizar'}</div>
                    <div className="mini" style={{ marginTop: 4 }}>
                      {l.nextAction} · {l.daysInStage} d
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      <Link className="btn sm" href={`/cotizar?client=${encodeURIComponent(l.company)}&area=${l.area || ''}`}>
                        Cotizar
                      </Link>
                      {i < 4 && (
                        <form action={advanceLeadAction}>
                          <input type="hidden" name="leadId" value={l.id} />
                          <button className="btn sm ghost" type="submit">
                            → {STAGES[i + 1]}
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card tbl" style={{ marginTop: 15 }}>
        <table>
          <thead>
            <tr>
              <th>Cuenta</th>
              <th>Sector</th>
              <th className="num">Activos</th>
              <th className="num">m² bajo garantía</th>
              <th className="num">Cotizaciones</th>
              <th>Próxima acción</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const warrantyArea = c.assets.reduce((x, a) => x + (a.area || 0), 0);
              return (
                <tr key={c.id}>
                  <td>
                    <b>{c.name}</b>
                  </td>
                  <td>{c.sector}</td>
                  <td className="num">{c.assets.length}</td>
                  <td className="num">{warrantyArea ? warrantyArea.toLocaleString('es-MX') : '—'}</td>
                  <td className="num">{c.quotes.length}</td>
                  <td>
                    <span className="badge info">{c.assets[0]?.note || 'Seguimiento'}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
