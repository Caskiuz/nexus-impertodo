import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import { fmt, dateStr, periodOf } from '@/lib/constants';
import {
  registerSaleAction,
  calculateRoyaltyAction,
  chargeTechFeeAction,
  createProductOrderAction,
  markRoyaltyPaidAction,
  markFeePaidAction
} from './actions';

export default async function CentralPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [units, sales, royalties, fees, orders] = await Promise.all([
    prisma.unit.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.sale.findMany({ orderBy: { date: 'desc' } }),
    prisma.royaltyPeriod.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.techFee.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.productOrder.findMany({ orderBy: { createdAt: 'desc' } })
  ]);

  const unitName = (id: string) => units.find((u) => u.id === id)?.name || 'Unidad';
  const period = periodOf(new Date());

  const messages: Record<string, string> = {
    venta: 'Venta timbrada registrada. Calcula la regalía del período para devengarla y notificar la comisión.',
    regalia: 'Regalía calculada: evento registrado, comisión 20% devengada y aviso en la bandeja.',
    fee: 'Fee tecnológico generado: comisión devengada.',
    feeexistente: 'Ese fee ya existe para el período.',
    pedido: 'Pedido de producto registrado: comisión devengada.',
    pagada: 'Marcado como pagado (registro manual).'
  };
  const errors: Record<string, string> = {
    rol: 'Solo Central, Gerencia o el desarrollador pueden operar la red.',
    datos: 'Completa los datos requeridos.',
    duplicado: 'UUID duplicado: la venta ya existe.',
    sinventas: 'No hay ventas timbradas en ese período.'
  };

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">Red · central</div>
          <h1>Central</h1>
          <div className="sub">Ventas timbradas, regalías 6%+2%, fee tecnológico y pedidos de producto. Cada movimiento devenga la comisión del desarrollador.</div>
        </div>
      </div>
      {sp.msg && <div className="alert g">{messages[sp.msg] || 'Listo.'}</div>}
      {sp.err && <div className="alert r">{errors[sp.err] || 'Error.'}</div>}

      <div className="grid-4" style={{ marginBottom: 14 }}>
        <div className="card kpi">
          <div className="lbl">Ventas timbradas de la red</div>
          <div className="val">{fmt(sales.reduce((x, s) => x + s.amount, 0))}</div>
          <div className="d">{sales.length} ventas</div>
        </div>
        <div className="card kpi">
          <div className="lbl">Regalías calculadas</div>
          <div className="val">{fmt(royalties.reduce((x, r) => x + r.total, 0))}</div>
          <div className="d">{royalties.length} períodos</div>
        </div>
        <div className="card kpi">
          <div className="lbl">Fee tecnológico</div>
          <div className="val">{fmt(fees.reduce((x, f) => x + f.amount, 0))}</div>
          <div className="d">$2,500 / unidad / mes</div>
        </div>
        <div className="card kpi">
          <div className="lbl">Pedidos de producto</div>
          <div className="val">{fmt(orders.reduce((x, o) => x + o.total, 0))}</div>
          <div className="d">{orders.length} pedidos</div>
        </div>
      </div>

      <div className="two">
        <form action={registerSaleAction} className="card panel">
          <div className="sec">Registrar venta timbrada</div>
          <div className="mini" style={{ marginBottom: 8 }}>Con UUID de CFDI se bloquea el duplicado. Sin pasarela: el cobro se registra manualmente.</div>
          <div className="row2">
            <div className="field">
              <label>Unidad</label>
              <select name="unitId">
                {units.filter((u) => u.kind !== 'PROSPECTO').map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Cliente</label>
              <input name="customer" required placeholder="Parque Industrial Apodaca" />
            </div>
            <div className="field">
              <label>Descripción</label>
              <input name="description" required placeholder="Impermeabilización nave · SBS 4.5" />
            </div>
            <div className="field">
              <label>Importe (MXN sin IVA)</label>
              <input name="amount" type="number" step="0.01" min="0" required />
            </div>
            <div className="field">
              <label>Folio</label>
              <input name="folio" placeholder="MTY-2026-013" />
            </div>
            <div className="field">
              <label>UUID CFDI (opcional)</label>
              <input name="uuid" placeholder="00000000-0000-4000-8000-000000000000" />
            </div>
          </div>
          <button className="btn primary" type="submit">
            Registrar venta
          </button>
        </form>

        <div className="stack">
          <form action={calculateRoyaltyAction} className="card panel">
            <div className="sec">Calcular regalía del período</div>
            <div className="row2">
              <div className="field">
                <label>Unidad</label>
                <select name="unitId">
                  {units.filter((u) => u.kind !== 'PROSPECTO').map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Período</label>
                <input name="period" defaultValue={period} placeholder="2026-10" />
              </div>
            </div>
            <button className="btn primary" type="submit">
              Calcular 6% + 2% sobre ventas timbradas
            </button>
            <div className="mini" style={{ marginTop: 6 }}>Si recalcula, solo se devenga la diferencia para no duplicar comisión.</div>
          </form>

          <form action={chargeTechFeeAction} className="card panel">
            <div className="sec">Fee tecnológico</div>
            <div className="row2">
              <div className="field">
                <label>Unidad</label>
                <select name="unitId">
                  {units.filter((u) => u.kind !== 'PROSPECTO').map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Período</label>
                <input name="period" defaultValue={period} />
              </div>
            </div>
            <button className="btn" type="submit">
              Generar fee $2,500
            </button>
          </form>

          <form action={createProductOrderAction} className="card panel">
            <div className="sec">Pedido de producto (exclusivo PROSEALMASTER)</div>
            <div className="row2">
              <div className="field">
                <label>Unidad</label>
                <select name="unitId">
                  {units.filter((u) => u.kind !== 'PROSPECTO').map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Producto</label>
                <input name="item" placeholder="Rollo SBS 4.5 mm" />
              </div>
              <div className="field">
                <label>Cantidad</label>
                <input name="qty" type="number" defaultValue={10} />
              </div>
              <div className="field">
                <label>Precio unitario (compra)</label>
                <input name="unitPrice" type="number" defaultValue={1050} />
              </div>
            </div>
            <button className="btn" type="submit">
              Registrar pedido
            </button>
            <div className="mini" style={{ marginTop: 6 }}>El franquiciado ve precio de compra, nunca landed.</div>
          </form>
        </div>
      </div>

      <div className="two" style={{ marginTop: 14 }}>
        <div className="card tbl">
          <div className="sec" style={{ padding: '14px 14px 0' }}>Ventas timbradas</div>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Unidad</th>
                <th>Cliente</th>
                <th className="num">Monto</th>
                <th>UUID</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id}>
                  <td>{dateStr(s.date)}</td>
                  <td>{unitName(s.unitId)}</td>
                  <td>
                    {s.customer}
                    <div className="mini">{s.description}</div>
                  </td>
                  <td className="num monto">{fmt(s.amount)}</td>
                  <td className="mono">{s.uuid ? `${s.uuid.slice(0, 8)}…` : '—'}</td>
                </tr>
              ))}
              {!sales.length && (
                <tr>
                  <td colSpan={5} className="mini">
                    Sin ventas registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card tbl">
          <div className="sec" style={{ padding: '14px 14px 0' }}>Regalías (6% + 2%)</div>
          <table>
            <thead>
              <tr>
                <th>Unidad</th>
                <th>Período</th>
                <th className="num">Ventas</th>
                <th className="num">Regalía</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {royalties.map((r) => (
                <tr key={r.id}>
                  <td>{unitName(r.unitId)}</td>
                  <td>{r.period}</td>
                  <td className="num">{fmt(r.salesTotal)}</td>
                  <td className="num monto">{fmt(r.total)}</td>
                  <td>
                    <span className={`badge ${r.status === 'PAGADA' ? 'ok' : 'warn'}`}>{r.status}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {r.status !== 'PAGADA' && (
                      <form action={markRoyaltyPaidAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <button className="btn sm" type="submit">
                          Marcar pagada
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {!royalties.length && (
                <tr>
                  <td colSpan={6} className="mini">
                    Sin regalías calculadas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="two" style={{ marginTop: 14 }}>
        <div className="card tbl">
          <div className="sec" style={{ padding: '14px 14px 0' }}>Fees tecnológicos</div>
          <table>
            <thead>
              <tr>
                <th>Unidad</th>
                <th>Período</th>
                <th className="num">Monto</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {fees.map((f) => (
                <tr key={f.id}>
                  <td>{unitName(f.unitId)}</td>
                  <td>{f.period}</td>
                  <td className="num">{fmt(f.amount)}</td>
                  <td>
                    <span className={`badge ${f.status === 'PAGADO' ? 'ok' : 'warn'}`}>{f.status}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {f.status !== 'PAGADO' && (
                      <form action={markFeePaidAction}>
                        <input type="hidden" name="id" value={f.id} />
                        <button className="btn sm" type="submit">
                          Marcar pagado
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {!fees.length && (
                <tr>
                  <td colSpan={5} className="mini">
                    Sin fees generados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card tbl">
          <div className="sec" style={{ padding: '14px 14px 0' }}>Pedidos de producto</div>
          <table>
            <thead>
              <tr>
                <th>Unidad</th>
                <th>Producto</th>
                <th className="num">Cant.</th>
                <th className="num">Total</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{unitName(o.unitId)}</td>
                  <td>{o.item}</td>
                  <td className="num">{o.qty}</td>
                  <td className="num monto">{fmt(o.total)}</td>
                  <td>
                    <span className="badge info">{o.status}</span>
                  </td>
                </tr>
              ))}
              {!orders.length && (
                <tr>
                  <td colSpan={5} className="mini">
                    Sin pedidos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
