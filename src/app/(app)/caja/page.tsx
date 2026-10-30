import { prisma } from '@/lib/prisma';
import { requireUser, getActiveUnitId } from '@/lib/session';
import { fmt, dateStr, FLOW } from '@/lib/constants';
import { addExpenseAction, uploadXmlAction } from '@/actions/docs';
import { reviewDocAction, authorizeDocAction, rejectDocAction } from '@/actions/docs';

export default async function CajaPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string; tab?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const unitId = await getActiveUnitId(user);
  const scope = unitId ? { unitId } : {};

  const [docs, invoices] = await Promise.all([
    prisma.doc.findMany({ where: scope, orderBy: { date: 'desc' } }),
    prisma.invoice.findMany({ where: scope })
  ]);

  const income = docs.filter((d) => d.income && d.status === 'AUTORIZADO').reduce((x, d) => x + d.total, 0);
  const expenses = docs.filter((d) => !d.income && d.status === 'AUTORIZADO').reduce((x, d) => x + d.total, 0);
  const iva = docs.filter((d) => !d.income && d.status !== 'RECHAZADO').reduce((x, d) => x + d.iva, 0);
  const pending = docs.filter((d) => d.status === 'PENDIENTE' || d.status === 'REVISADO');
  const sourceLabel: Record<string, string> = { SAT: 'SAT', CORREO: 'Correo', FOTO: 'Foto', BANCO: 'Banco', MANUAL: 'Manual' };

  const messages: Record<string, string> = {
    agregado: 'Gasto agregado a la bandeja. Sin asiento contable hasta autorización.',
    xml: 'XML leído en servidor y agregado a la bandeja (sin validación SAT).',
    revisado: 'Comprobante revisado por Administración. Falta Gerencia.'
  };
  const errors: Record<string, string> = {
    datos: 'Proveedor e importe válido son obligatorios.',
    archivo: 'Selecciona un archivo XML.',
    tamano: 'El archivo supera 8 MB.',
    xml: 'El archivo no parece un CFDI legible.',
    duplicado: 'UUID duplicado: el comprobante ya existe y no se agregó.'
  };

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">Contabilidad sin capturar</div>
          <h1>Caja y contabilidad fácil</h1>
          <div className="sub">La bandeja se llena con XML CFDI, captura y banco. La IA clasifica; tú apruebas. Nunca contabiliza ni paga sola.</div>
        </div>
      </div>
      {sp.msg && <div className="alert g">{messages[sp.msg] || 'Listo.'}</div>}
      {sp.err && <div className="alert r">{errors[sp.err] || 'Ocurrió un error.'}</div>}

      <div className="grid-4" style={{ marginBottom: 14 }}>
        <div className="card kpi">
          <div className="lbl">Ingresos registrados</div>
          <div className="val">{fmt(income)}</div>
          <div className="d">autorizados</div>
        </div>
        <div className="card kpi">
          <div className="lbl">Egresos aprobados</div>
          <div className="val">{fmt(expenses)}</div>
          <div className="d">con dos revisiones</div>
        </div>
        <div className="card kpi">
          <div className="lbl">IVA registrado</div>
          <div className="val">{fmt(iva)}</div>
          <div className="d">referencial · no póliza</div>
        </div>
        <div className="card kpi">
          <div className="lbl">Bandeja</div>
          <div className="val" style={{ color: pending.length ? 'var(--naranja)' : 'var(--verde)' }}>{pending.length}</div>
          <div className="d">por revisar</div>
        </div>
      </div>

      <div className="two">
        <div className="card panel">
          <div className="sec">Agregar comprobante</div>
          <form action={uploadXmlAction} style={{ marginBottom: 12 }}>
            <label className="drop" style={{ display: 'block', marginBottom: 8 }}>
              <div className="big">📄</div>
              <b>Subir CFDI XML</b>
              <div className="mini">Se parsea en el servidor y se deduplica por UUID. Sin validación SAT.</div>
              <input type="file" name="file" accept=".xml,text/xml,application/xml" style={{ marginTop: 8 }} />
            </label>
            <button className="btn azul sm" type="submit">
              Procesar XML
            </button>
          </form>
          <form action={addExpenseAction}>
            <div className="row2">
              <div className="field">
                <label>Proveedor</label>
                <input name="supplier" required placeholder="Materiales del Norte" />
              </div>
              <div className="field">
                <label>Importe total (MXN)</label>
                <input name="total" type="number" step="0.01" min="0" required />
              </div>
              <div className="field">
                <label>Categoría</label>
                <select name="category">
                  <option>Material de obra</option>
                  <option>Mano de obra</option>
                  <option>Viáticos / traslado</option>
                  <option>Herramienta menor</option>
                  <option>Administración</option>
                  <option>Ingreso · anticipo</option>
                </select>
              </div>
              <div className="field">
                <label>Obra / centro de costo</label>
                <input name="workRef" placeholder="OT-2026-088" />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Descripción / folio</label>
                <input name="description" placeholder="Detalle de la compra" />
              </div>
            </div>
            <button className="btn primary" type="submit">
              Agregar a revisión (no contabiliza)
            </button>
          </form>
        </div>

        <div className="card panel">
          <div className="sec">Flujo de aprobación</div>
          <div className="flow" style={{ marginBottom: 12 }}>
            {FLOW.map((f, i) => (
              <span key={f}>
                {i + 1} {f}
                {i < FLOW.length - 1 && <i> →</i>}
              </span>
            ))}
          </div>
          <div className="rule">
            <span className="ic ok">✓</span>
            <div>El XML manda sobre la foto. UUID duplicado: alerta y revisión.</div>
          </div>
          <div className="rule">
            <span className="ic info">i</span>
            <div>La IA puede equivocarse leyendo importes; la revisión humana es obligatoria.</div>
          </div>
          <div className="rule">
            <span className="ic warn">!</span>
            <div>La conciliación bancaria y la póliza se cierran en el ERP fiscal, no aquí.</div>
          </div>
          <div className="alert b" style={{ marginTop: 12 }}>
            <b>Pendiente en producción:</b> SAT masivo con e.firma, correo facturas@ y OCR real. Hoy: XML real + captura + bandeja.
          </div>
        </div>
      </div>

      <div className="card tbl" style={{ marginTop: 15 }}>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Proveedor</th>
              <th>Fuente</th>
              <th>Obra</th>
              <th className="num">Total</th>
              <th className="num">IVA</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td>{dateStr(d.date)}</td>
                <td>
                  <b>{d.supplier}</b>
                  <div className="mini">{d.description}</div>
                  {d.warn && <span className="badge bad">{d.warn}</span>}
                </td>
                <td>
                  <span className={`src ${d.source.toLowerCase()}`}>{sourceLabel[d.source] || d.source}</span>
                </td>
                <td>{d.workRef || '—'}</td>
                <td className="num monto">{fmt(d.total)}</td>
                <td className="num">{d.iva ? fmt(d.iva) : '—'}</td>
                <td>
                  <span
                    className={`badge ${
                      d.status === 'AUTORIZADO' ? 'ok' : d.status === 'REVISADO' ? 'info' : d.status === 'RECHAZADO' ? 'bad' : 'warn'
                    }`}
                  >
                    {d.status}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    {d.status === 'PENDIENTE' && (
                      <form action={reviewDocAction}>
                        <input type="hidden" name="docId" value={d.id} />
                        <input type="hidden" name="redirectTo" value="/caja" />
                        <button className="btn sm" type="submit">
                          Revisar
                        </button>
                      </form>
                    )}
                    {d.status === 'REVISADO' && (
                      <form action={authorizeDocAction}>
                        <input type="hidden" name="docId" value={d.id} />
                        <input type="hidden" name="redirectTo" value="/caja" />
                        <button className="btn sm primary" type="submit">
                          Autorizar
                        </button>
                      </form>
                    )}
                    {d.status !== 'AUTORIZADO' && d.status !== 'RECHAZADO' && (
                      <form action={rejectDocAction}>
                        <input type="hidden" name="docId" value={d.id} />
                        <input type="hidden" name="redirectTo" value="/caja" />
                        <button className="btn sm ghost" type="submit">
                          Rechazar
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!docs.length && (
              <tr>
                <td colSpan={8} className="mini">
                  Sin comprobantes. Sube un XML o captura un gasto.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="two" style={{ marginTop: 15 }}>
        <div className="card tbl">
          <div className="sec" style={{ padding: '14px 14px 0' }}>
            Libro · ingresos y egresos
          </div>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Concepto</th>
                <th>Categoría</th>
                <th className="num">Monto</th>
              </tr>
            </thead>
            <tbody>
              {docs
                .filter((d) => d.status === 'AUTORIZADO')
                .slice(0, 8)
                .map((d) => (
                  <tr key={d.id}>
                    <td>{dateStr(d.date)}</td>
                    <td>{d.supplier}</td>
                    <td>{d.category}</td>
                    <td className="num monto" style={{ color: d.income ? 'var(--verde-600)' : 'var(--rojo)' }}>
                      {d.income ? '+' : '−'}
                      {fmt(d.total)}
                    </td>
                  </tr>
                ))}
              {!docs.some((d) => d.status === 'AUTORIZADO') && (
                <tr>
                  <td colSpan={4} className="mini">
                    Aún no hay movimientos autorizados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="card panel">
          <div className="sec">Utilidad real por obra</div>
          <div className="tbl">
            <table>
              <thead>
                <tr>
                  <th>Obra</th>
                  <th className="num">Ingresos</th>
                  <th className="num">Egresos</th>
                  <th className="num">Utilidad</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { obra: 'OT-2026-088 OXXO', inc: 208600, eg: 152300 },
                  { obra: 'OT-2026-089 Nave Lagunero', inc: 598000, eg: 389100 },
                  { obra: 'OT-2026-090 Maseca', inc: 0, eg: 0 }
                ].map((r) => (
                  <tr key={r.obra}>
                    <td>{r.obra}</td>
                    <td className="num">{fmt(r.inc)}</td>
                    <td className="num">{fmt(r.eg)}</td>
                    <td className="num monto">{fmt(r.inc - r.eg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mini" style={{ marginTop: 8 }}>
            Real = vendido − material real − destajo − gastos de obra. Datos demo conciliables.
          </div>
          <div className="mini">Facturas por cobrar activas: {invoices.filter((i) => i.status === 'PENDIENTE').length}</div>
        </div>
      </div>
    </>
  );
}
