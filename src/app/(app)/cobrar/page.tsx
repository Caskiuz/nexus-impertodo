import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireUser, getActiveUnitId } from '@/lib/session';
import { fmt, dateStr } from '@/lib/constants';
import { remindInvoiceAction, payInvoiceAction, addCollectionNoteAction } from './actions';

export default async function CobrarPage({ searchParams }: { searchParams: Promise<{ q?: string; msg?: string; err?: string; client?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const unitId = await getActiveUnitId(user);
  const scope = unitId ? { unitId } : {};
  const invoices = await prisma.invoice.findMany({ where: scope, orderBy: { dueDate: 'asc' } });
  const notes = await prisma.collectionNote.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });

  const q = (sp.q || '').toLowerCase();
  const list = q ? invoices.filter((i) => i.clientName.toLowerCase().includes(q)) : invoices;
  const pending = invoices.filter((i) => i.status === 'PENDIENTE');
  const overdue = pending.filter((i) => i.dueDate < new Date());
  const total = pending.reduce((x, i) => x + i.amount, 0);
  const overdueSum = overdue.reduce((x, i) => x + i.amount, 0);

  // Expediente por cliente: cada cliente con factura es una cuenta controlable.
  const clientsWithInvoices = Array.from(new Set(invoices.map((i) => i.clientName))).sort();
  const selectedClient = sp.client ? clientsWithInvoices.find((c) => c === sp.client) : undefined;
  const clientInvoices = selectedClient ? invoices.filter((i) => i.clientName === selectedClient) : [];
  const clientPaid = clientInvoices.filter((i) => i.status === 'PAGADA').reduce((x, i) => x + i.amount, 0);
  const clientPendingSum = clientInvoices.filter((i) => i.status === 'PENDIENTE').reduce((x, i) => x + i.amount, 0);
  const clientOverdueSum = clientInvoices
    .filter((i) => i.status === 'PENDIENTE' && i.dueDate < new Date())
    .reduce((x, i) => x + i.amount, 0);
  const clientNotes = selectedClient ? notes.filter((n) => n.clientName === selectedClient) : [];

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">Caja</div>
          <h1>Cobrar</h1>
          <div className="sub">Quién debe, desde cuándo y un botón para recordar. Controla cliente por cliente con su expediente y notas de gestión.</div>
        </div>
        {q && <span className="badge info">Filtro: {sp.q}</span>}
      </div>
      {sp.msg === 'recordatorio' && <div className="alert g">Recordatorio registrado en el expediente del cliente (demo, sin envío real).</div>}
      {sp.msg === 'pagada' && <div className="alert g">Factura marcada como pagada. Concilia con el XML del CFDI en Caja.</div>}
      {sp.msg === 'nota' && <div className="alert g">Nota de gestión de cobro guardada en el expediente.</div>}
      {sp.err === 'nota' && <div className="alert r">Escribe la nota antes de guardar.</div>}

      <div className="card panel" style={{ marginBottom: 14 }}>
        <div className="sec">Control por cliente <span className="badge">expediente de cobranza</span></div>
        <div className="mini" style={{ marginBottom: 8 }}>
          Selecciona un cliente para llevar su control: cuánto debe, qué está vencido y las notas de gestión (promesas de pago, acuerdos,
          llamadas).
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {clientsWithInvoices.map((c) => (
            <Link key={c} className={`btn sm ${selectedClient === c ? 'azul' : ''}`} href={`/cobrar?client=${encodeURIComponent(c)}`}>
              {c}
            </Link>
          ))}
          {!clientsWithInvoices.length && <span className="mini">Sin facturas todavía.</span>}
        </div>
      </div>

      {selectedClient && (
        <div className="card panel" style={{ marginBottom: 14, borderColor: 'var(--azul-100)' }}>
          <div className="sec">
            Expediente · {selectedClient}{' '}
            <Link className="btn sm" href="/cobrar" style={{ marginLeft: 8 }}>
              Cerrar
            </Link>
          </div>
          <div className="grid-4" style={{ marginBottom: 12 }}>
            <div className="card kpi">
              <div className="lbl">Saldo pendiente</div>
              <div className="val">{fmt(clientPendingSum)}</div>
              <div className="d">{clientInvoices.filter((i) => i.status === 'PENDIENTE').length} facturas</div>
            </div>
            <div className="card kpi">
              <div className="lbl">Vencido</div>
              <div className="val" style={{ color: clientOverdueSum ? 'var(--rojo)' : 'var(--verde)' }}>{fmt(clientOverdueSum)}</div>
              <div className="d">exige gestión hoy</div>
            </div>
            <div className="card kpi">
              <div className="lbl">Pagado</div>
              <div className="val" style={{ color: 'var(--verde)' }}>{fmt(clientPaid)}</div>
              <div className="d">{clientInvoices.filter((i) => i.status === 'PAGADA').length} facturas pagadas</div>
            </div>
            <div className="card kpi">
              <div className="lbl">Total facturado</div>
              <div className="val">{fmt(clientPaid + clientPendingSum)}</div>
              <div className="d">histórico con este cliente</div>
            </div>
          </div>
          <div className="tbl">
            <table>
              <thead>
                <tr>
                  <th>Factura</th>
                  <th className="num">Monto</th>
                  <th>Vence</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {clientInvoices.map((inv) => {
                  const overdueDays = Math.floor((Date.now() - inv.dueDate.getTime()) / 86400000);
                  return (
                    <tr key={inv.id}>
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
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
              </tbody>
            </table>
          </div>
          <div className="sec" style={{ marginTop: 12 }}>Notas de gestión de cobro</div>
          {clientNotes.map((n) => (
            <div className="rule" key={n.id}>
              <span className="ic info">i</span>
              <div>
                {n.note}
                <div className="mini">
                  {n.createdAt.toLocaleString('es-MX')} · {n.userName || '—'}
                </div>
              </div>
            </div>
          ))}
          {!clientNotes.length && <div className="mini" style={{ marginBottom: 8 }}>Sin notas: anota aquí las promesas de pago y acuerdos con este cliente.</div>}
          <form action={addCollectionNoteAction} style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <input type="hidden" name="clientName" value={selectedClient} />
            <input
              name="note"
              placeholder='Ej. "Prometió pagar el viernes por transferencia" o "Enviar recordatorio cada lunes"'
              style={{ flex: 1, minWidth: 260 }}
              required
            />
            <button className="btn primary sm" type="submit">
              Guardar nota
            </button>
          </form>
        </div>
      )}

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
