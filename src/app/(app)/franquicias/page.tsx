import { prisma } from '@/lib/prisma';
import { requireUser, getActiveUnitId } from '@/lib/session';
import { fmt, NETWORK_RULES } from '@/lib/constants';
import { createFranchiseAction, acquireFranchiseAction } from './actions';

export default async function FranquiciasPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const units = await prisma.unit.findMany({ orderBy: { createdAt: 'asc' } });
  const franchises = await prisma.franchise.findMany({ orderBy: { createdAt: 'desc' } });
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const [quotes, sales, royalties, techFees, orders] = await Promise.all([
    prisma.quote.findMany({ where: { createdAt: { gte: start } } }),
    prisma.sale.findMany(),
    prisma.royaltyPeriod.findMany(),
    prisma.techFee.findMany(),
    prisma.productOrder.findMany()
  ]);

  const messages: Record<string, string> = {
    creado: 'Prospecto de franquicia creado.',
    adquirida: 'Franquicia adquirida: unidad activada, evento registrado y comisión 20% devengada en la bandeja.'
  };
  const errors: Record<string, string> = {
    rol: 'Solo Central, Gerencia o el desarrollador pueden operar la red.',
    datos: 'Completa los datos requeridos.',
    noexiste: 'La franquicia ya no existe.'
  };

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">Red</div>
          <h1>Franquicias y marca blanca</h1>
          <div className="sub">Cada unidad opera su instancia; la central ve ventas timbradas, regalías y pedidos de producto.</div>
        </div>
      </div>
      {sp.msg && <div className="alert g">{messages[sp.msg] || 'Listo.'}</div>}
      {sp.err && <div className="alert r">{errors[sp.err] || 'Error.'}</div>}

      <div className="grid-3">
        {units.map((u) => {
          const unitQuotes = quotes.filter((q) => q.unitId === u.id);
          const avg = unitQuotes.length ? unitQuotes.reduce((x, q) => x + q.margin, 0) / unitQuotes.length : 0;
          const sold = sales.filter((s) => s.unitId === u.id).reduce((x, s) => x + s.amount, 0);
          const royalty = royalties.filter((r) => r.unitId === u.id).reduce((x, r) => x + r.total, 0);
          const badge = u.kind === 'MATRIZ' ? 'ok' : u.kind === 'PILOTO' ? 'warn' : u.kind === 'ACTIVA' ? 'info' : 'info';
          return (
            <div className="card panel" key={u.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <b>{u.name}</b>
                <span className={`badge ${badge}`}>{u.kind}</span>
              </div>
              <div className="sumline">
                <span>Cotizaciones mes</span>
                <b>{unitQuotes.length}</b>
              </div>
              <div className="sumline">
                <span>Margen promedio</span>
                <b>{(avg * 100).toFixed(0)}%</b>
              </div>
              <div className="sumline">
                <span>Producto vendido</span>
                <b>{fmt(u.investment && u.kind === 'PROSPECTO' ? u.investment : sold)}</b>
              </div>
              <div className="sumline">
                <span>{u.kind === 'PROSPECTO' ? 'Inversión estimada' : 'Regalía acumulada (8%)'}</span>
                <b>{u.kind === 'PROSPECTO' ? fmt(u.investment) : fmt(royalty)}</b>
              </div>
              {u.kind === 'PROSPECTO' && (
                <div className="sumline">
                  <span>Factibilidad</span>
                  <b>{u.feasibility || 'Por evaluar'}</b>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card panel" style={{ marginTop: 14 }}>
        <div className="sec">Reglas de red</div>
        {NETWORK_RULES.map((r, i) => (
          <div className="rule" key={i}>
            <span className={`ic ${r.ok ? 'ok' : 'warn'}`}>{r.ok ? '✓' : '!'}</span>
            <div>{r.text}</div>
          </div>
        ))}
      </div>

      <div className="two" style={{ marginTop: 14 }}>
        <div className="card panel">
          <div className="sec">Pipeline de franquicias</div>
          {franchises.map((f) => (
            <div className="rule" key={f.id}>
              <span className={`ic ${f.stage === 'ACTIVA' || f.stage === 'PILOTO' ? 'ok' : 'info'}`}>
                {f.stage === 'ACTIVA' ? '✓' : '•'}
              </span>
              <div style={{ flex: 1 }}>
                <b>{f.name}</b> · {f.city || '—'}
                <div className="mini">
                  {f.stage} · inversión {f.investment ? fmt(f.investment) : 'por definir'} · factibilidad {f.feasibility || 'por evaluar'}
                </div>
              </div>
              {f.stage !== 'ACTIVA' && (
                <form action={acquireFranchiseAction} style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  <input type="hidden" name="franchiseId" value={f.id} />
                  <input type="number" name="fee" placeholder="Cuota inicial" defaultValue={f.fee || f.investment || ''} style={{ width: 110 }} />
                  <button className="btn sm primary" type="submit">
                    Adquirir
                  </button>
                </form>
              )}
            </div>
          ))}
          {!franchises.length && <div className="mini">Sin franquicias en pipeline.</div>}
        </div>

        <form action={createFranchiseAction} className="card panel">
          <div className="sec">Nuevo prospecto de franquicia</div>
          <div className="row2">
            <div className="field">
              <label>Nombre</label>
              <input name="name" required placeholder="Unidad Querétaro" />
            </div>
            <div className="field">
              <label>Ciudad</label>
              <input name="city" />
            </div>
            <div className="field">
              <label>Contacto</label>
              <input name="contact" />
            </div>
            <div className="field">
              <label>Inversión estimada (MXN)</label>
              <input name="investment" type="number" defaultValue={650000} />
            </div>
            <div className="field">
              <label>Etapa</label>
              <select name="stage">
                <option value="PROSPECTO">Prospecto</option>
                <option value="EVALUACION">Evaluación</option>
                <option value="PILOTO">Piloto</option>
              </select>
            </div>
            <div className="field">
              <label>Factibilidad</label>
              <select name="feasibility">
                <option value="Alta">Alta</option>
                <option value="Media">Media</option>
                <option value="Baja">Baja</option>
                <option value="Por evaluar">Por evaluar</option>
              </select>
            </div>
          </div>
          <button className="btn primary" type="submit">
            Crear prospecto
          </button>
          <div className="mini" style={{ marginTop: 10 }}>
            Unidades con ventas timbradas en el mes: {sales.length} · regalías calculadas: {royalties.length} · fees: {techFees.length} · pedidos: {orders.length}
          </div>
        </form>
      </div>
    </>
  );
}
