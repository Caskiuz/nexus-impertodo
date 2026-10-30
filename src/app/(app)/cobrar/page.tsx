import { prisma } from '@/lib/prisma';
import { requireUser, getActiveUnitId } from '@/lib/session';
import { fmt, dateStr } from '@/lib/constants';
import { remindInvoiceAction, payInvoiceAction } from './actions';

export default async function CobrarPage({ searchParams }: { searchParams: Promise<{ q?: string; msg?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const unitId = await getActiveUnitId(user);
  const scope = unitId ? { unitId } : {};
  const invoices = await prisma.invoice.findMany({ where: scope, orderBy: { dueDate: 'asc' } });

  const q = (sp.q || '').toLowerCase();
  const list = q ? invoices.filter((i) => i.clientName.toLowerCase().includes(q)) : invoices;
  const pending = invoices.filter((i) => i.status === 'PENDIENTE');
  const overdue = pending.filter((i) => i.dueDate < new Date());
  const total = pending.reduce((x, i) => x + i.amount, 0);
  const overdueSum = overdue.reduce((x, i) => x + i.amount, 0);

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">Caja</div>
          <h1>Cobrar</h1>
          <div className="sub">Quién debe, desde cuándo y un botón para recordar. El cobro se registra manualmente (sin pasarela aún).</div>
        </div>
        {q && <span className="badge info">Filtro: {sp.q}</span>}
      </div>
      {sp.msg === 'recordatorio' && <div className="alert g">Recordatorio registrado en el expediente del cliente (demo, sin envío real).</div>}
      {sp.msg === 'pagada' && <div className="alert g">Factura marcada como pagada. Concilia con el XML del CFDI en Caja.</div>}

      <div className="grid-4" style={{ marginBottom: 14 }}>
        <div className="card kpi">
          <div className="lbl">Por cobrar</div>
          <div className="val">{fmt(total)}</div>
          <div className="d">{pending.length} facturas</div>
        </div>
        <div className="card kpi">
          <div className="lbl">Vencido</div>
          <div className="val" style={{ color: 'var(--rojo)' }}>{fmt(overdueSum)}</div>
          <div className="d">{overdue.length} facturas</div>
        </div>
        <div className="card kpi">
          <div className="lbl">DSO estimado</div>
          <div className="val">38 días</div>
          <div className="d">meta 25</div>
        </div>
        <div className="card kpi">
          <div className="lbl">Cobrado mes</div>
          <div className="val" style={{ color: 'var(--verde)' }}>{fmt(total - overdueSum)}</div>
          <div className="d">recuperable</div>
        </div>
      </div>

      <div className="card tbl">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Factura</th>
              <th className="num">Monto</th>
              <th>Vence</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((inv) => {
              const overdueDays = Math.floor((Date.now() - inv.dueDate.getTime()) / 86400000);
              return (
                <tr key={inv.id}>
                  <td>
                    <b>{inv.clientName}</b>
                  </td>
                  <td>{inv.folio}</td>
                  <td className="num monto">{fmt(inv.amount)}</td>
                  <td>{dateStr(inv.dueDate)}</td>
                  <td>
                    {inv.status === 'PAGADA' ? (
                      <span className="badge ok">Pagada</span>
                    ) : overdueDays > 0 ? (
                      <span className="badge bad">Vencida {overdueDays} d</span>
                    ) : (
                      <span className="badge ok">Vigente</span>
                    )}
                  </td>
                  <td>
                    {inv.status === 'PENDIENTE' && (
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <form action={remindInvoiceAction}>
                          <input type="hidden" name="invoiceId" value={inv.id} />
                          <button className="btn sm" type="submit">
                            Recordar
                          </button>
                        </form>
                        <form action={payInvoiceAction}>
                          <input type="hidden" name="invoiceId" value={inv.id} />
                          <button className="btn sm primary" type="submit">
                            Marcar pagada
                          </button>
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {!list.length && (
              <tr>
                <td colSpan={6} className="mini">
                  Sin facturas que coincidan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
