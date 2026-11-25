import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import { fmt, dateStr, dateFullStr, dateTimeStr, timeStr, dayKeyMX } from '@/lib/constants';
import { inventoryImage, inventorySvg } from '@/lib/images';
import SmartImage from '@/components/SmartImage';
import ProductPhotoManager from '@/components/ProductPhotoManager';
import Link from 'next/link';
import { addStockAction, suggestOrderAction, createProductAction, updateProductAction, deleteProductAction } from './actions';

// Los movimientos anteriores a la columna `type` registraban las salidas con cantidad negativa.
function esSalida(mov: { type: string; qty: number }): boolean {
  return mov.type === 'SALIDA' || mov.qty < 0;
}

const dayLabel = (key: string) => {
  const [, m, d] = key.split('-');
  return `${d}/${m}`;
};

// Vistas en pestañas: todo queda en la parte superior, sin bajar por la página.
const VISTAS = [
  { key: 'productos', label: '📦 Productos' },
  { key: 'consumos', label: '📅 Consumos diarios' },
  { key: 'kardex', label: '🧾 Kardex' },
  { key: 'movimientos', label: '📋 Movimientos' },
  { key: 'bitacora', label: '📜 Bitácora' }
] as const;

export default async function InventarioPage({
  searchParams
}: {
  searchParams: Promise<{ msg?: string; err?: string; edit?: string; del?: string; foto?: string; item?: string; vista?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  // Modificación de datos maestros (editar/eliminar/foto): solo Gerencia y el desarrollador.
  const canEdit = ['GERENCIA', 'DEV'].includes(user.role);
  // Alta de productos nuevos y movimientos de stock: como antes.
  const canCreate = ['ADMIN', 'CENTRAL', 'DEV', 'GERENCIA'].includes(user.role);
  const vista = (VISTAS.some((v) => v.key === sp.vista) ? sp.vista : 'productos') as (typeof VISTAS)[number]['key'];

  const settings = await prisma.settings.findUnique({ where: { id: 'default' } });
  const items = await prisma.inventoryItem.findMany({ orderBy: { name: 'asc' } });
  const movementsRaw = await prisma.stockMovement.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  const audit = await prisma.auditLog.findMany({ where: { module: 'inventario' }, orderBy: { createdAt: 'desc' }, take: 20 });

  // Kardex tipo Excel: filas = productos, columnas = últimos 12 movimientos en orden cronológico.
  const kardexTotal = await prisma.stockMovement.count();
  const kardexCols = [...movementsRaw.slice(0, 12)].reverse();
  const kardexStart = Math.max(1, kardexTotal - kardexCols.length + 1);
  const kardexByItem = new Map<string, Map<string, (typeof movementsRaw)[number]>>();
  for (const m of movementsRaw) {
    if (!kardexByItem.has(m.itemId)) kardexByItem.set(m.itemId, new Map());
    kardexByItem.get(m.itemId)!.set(m.id, m);
  }

  // Consumos diarios estilo Excel: filas = productos, columnas = últimos 10 días con salidas.
  const salidasRaw = await prisma.stockMovement.findMany({
    where: { OR: [{ type: 'SALIDA' }, { qty: { lt: 0 } }] },
    orderBy: { createdAt: 'asc' }
  });
  const consumoDays = Array.from(new Set(salidasRaw.map((m) => dayKeyMX(m.createdAt)))).slice(-10);
  const consumoDaysSet = new Set(consumoDays);
  const consumoByItem = new Map<string, Map<string, number>>();
  for (const m of salidasRaw) {
    const k = dayKeyMX(m.createdAt);
    if (!consumoDaysSet.has(k)) continue;
    if (!consumoByItem.has(m.itemId)) consumoByItem.set(m.itemId, new Map());
    const map = consumoByItem.get(m.itemId)!;
    map.set(k, Math.round(((map.get(k) || 0) + Math.abs(m.qty)) * 100) / 100);
  }

  const factor = settings?.provider === 'psm' ? 0.7 : 1;
  const value = items.reduce((x, i) => x + i.stock * i.cost * factor, 0);
  const low = items.filter((i) => i.stock < i.min);
  const editing = sp.edit ? items.find((i) => i.id === sp.edit) : undefined;
  const deleting = sp.del ? items.find((i) => i.id === sp.del) : undefined;
  const photoItem = sp.foto ? items.find((i) => i.id === sp.foto) : undefined;

  const itemMap = new Map(items.map((i) => [i.id, i]));
  const filterItem = sp.item ? itemMap.get(sp.item) : undefined;
  const movements = sp.item ? movementsRaw.filter((m) => m.itemId === sp.item) : movementsRaw;
  // En consumos, el filtro por producto deja solo esa fila.
  const consumoItems = filterItem ? [filterItem] : items;

  return (
    <>
      <div className="head" id="top">
        <div>
          <div className="eyebrow">Almacén</div>
          <h1>Inventario PROSEALMASTER</h1>
          <div className="sub">
            Stock, consumos, kardex y movimientos en una sola vista. Los datos maestros solo los modifican Gerencia y el desarrollador.
          </div>
        </div>
        <div className="actions">
          <a className="btn sm primary" href="/api/inventario/export" title="Descargar inventario completo en Excel">
            ⬇ Exportar a Excel
          </a>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 14 }}>
        {VISTAS.map((v) => (
          <Link key={v.key} className={`tab ${vista === v.key ? 'on' : ''}`} href={v.key === 'productos' ? '/inventario' : `/inventario?vista=${v.key}`}>
            {v.label}
          </Link>
        ))}
      </div>

      {sp.msg === 'movimiento' && <div className="alert g">Movimiento de inventario registrado con su documento y saldo.</div>}
      {sp.msg === 'pedido' && <div className="alert g">Pedido propuesto creado y avisado en la bandeja interna.</div>}
      {sp.msg === 'creado' && <div className="alert g">Producto creado y registrado en la bitácora y auditoría.</div>}
      {sp.msg === 'editado' && <div className="alert g">Producto actualizado: la bitácora registra qué cambió (antes → después).</div>}
      {sp.msg === 'eliminado' && <div className="alert g">Producto eliminado (con sus movimientos) y registrado en la bitácora.</div>}
      {sp.err === 'autoriza' && <div className="alert r">Solo Gerencia o el desarrollador pueden modificar o eliminar datos del inventario.</div>}
      {sp.err === 'rol' && <div className="alert r">Solo Administración, Central, Gerencia o el desarrollador pueden crear productos.</div>}
      {sp.err === 'alta' && <div className="alert r">Completa al menos el nombre del producto.</div>}
      {sp.err === 'datos' && <div className="alert r">Cantidad inválida.</div>}
      {sp.err === 'noexiste' && <div className="alert r">Ese producto ya no existe.</div>}

      {vista === 'productos' && (
        <>
          {editing && canEdit && (
            <div className="card panel" style={{ marginBottom: 14, borderColor: 'var(--azul-100)' }}>
              <div className="sec">Editar producto · {editing.name}</div>
              <form action={updateProductAction}>
                <input type="hidden" name="id" value={editing.id} />
                <div className="row3">
                  <div className="field">
                    <label>Nombre</label>
                    <input name="name" defaultValue={editing.name} required />
                  </div>
                  <div className="field">
                    <label>Unidad</label>
                    <input name="unitName" list="unidades-inv" defaultValue={editing.unitName} required />
                  </div>
                  <div className="field">
                    <label>Mínimo</label>
                    <input name="min" type="number" min="0" step="1" defaultValue={editing.min} />
                  </div>
                  <div className="field">
                    <label>Costo unitario (MXN)</label>
                    <input name="cost" type="number" min="0" step="0.01" defaultValue={editing.cost} />
                  </div>
                  <div className="field">
                    <label>Proveedor</label>
                    <input name="provider" list="proveedores-inv" defaultValue={editing.provider} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn primary" type="submit">
                    Guardar cambios
                  </button>
                  <Link className="btn" href="/inventario">
                    Cancelar
                  </Link>
                </div>
                <div className="mini" style={{ marginTop: 8 }}>
                  El stock se ajusta con entradas/salidas en la tabla, para que quede el movimiento registrado. Cada cambio queda en la
                  bitácora con antes → después.
                </div>
              </form>
            </div>
          )}

          {photoItem && canEdit && (
            <div className="card panel" style={{ marginBottom: 14, borderColor: 'var(--azul-100)' }}>
              <div className="sec">Foto del producto · {photoItem.name}</div>
              <ProductPhotoManager itemId={photoItem.id} name={photoItem.name} current={photoItem.photo} />
              <Link className="btn" href="/inventario" style={{ marginTop: 10 }}>
                Cerrar
              </Link>
            </div>
          )}

          {deleting && canEdit && (
            <div className="card panel" style={{ marginBottom: 14 }}>
              <div className="sec" style={{ color: 'var(--rojo)' }}>
                Eliminar producto
              </div>
              <p className="mini" style={{ marginBottom: 10 }}>
                Vas a eliminar <b>{deleting.name}</b> (stock {deleting.stock} {deleting.unitName}) y sus movimientos. Esta acción queda en la
                bitácora y no se puede deshacer.
              </p>
              <form action={deleteProductAction}>
                <input type="hidden" name="id" value={deleting.id} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" type="submit" style={{ background: 'var(--rojo)', color: '#fff', borderColor: 'transparent' }}>
                    Confirmar eliminación
                  </button>
                  <Link className="btn" href="/inventario">
                    Cancelar
                  </Link>
                </div>
              </form>
            </div>
          )}

          {canCreate && (
            <details className="card panel" style={{ marginBottom: 14 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 800, color: 'var(--azul-700)' }}>+ Nuevo producto</summary>
              <form action={createProductAction} style={{ marginTop: 12 }}>
                <div className="row3">
                  <div className="field">
                    <label>Nombre del producto</label>
                    <input name="name" required placeholder="Ej. Sellador acrílico blanco 19 L" />
                  </div>
                  <div className="field">
                    <label>Unidad</label>
                    <input name="unitName" list="unidades-inv" defaultValue="cubeta" required />
                    <datalist id="unidades-inv">
                      <option value="cubeta" />
                      <option value="rollo" />
                      <option value="kg" />
                      <option value="juego" />
                      <option value="L" />
                      <option value="pza" />
                      <option value="m²" />
                    </datalist>
                  </div>
                  <div className="field">
                    <label>Stock inicial</label>
                    <input name="stock" type="number" min="0" step="1" defaultValue={0} />
                  </div>
                  <div className="field">
                    <label>Mínimo</label>
                    <input name="min" type="number" min="0" step="1" defaultValue={10} />
                  </div>
                  <div className="field">
                    <label>Costo unitario (MXN)</label>
                    <input name="cost" type="number" min="0" step="0.01" defaultValue={0} />
                  </div>
                  <div className="field">
                    <label>Proveedor</label>
                    <input name="provider" list="proveedores-inv" defaultValue="PROSEALMASTER" />
                    <datalist id="proveedores-inv">
                      <option value="PROSEALMASTER" />
                      <option value="Kánuh (nacional)" />
                      <option value="Chovatek (nacional)" />
                      <option value="Nacional" />
                      <option value="Importado" />
                    </datalist>
                  </div>
                </div>
                <button className="btn primary" type="submit">
                  Crear producto
                </button>
                <span className="mini" style={{ marginLeft: 10 }}>
                  La acción queda registrada en la bitácora y auditoría.
                </span>
              </form>
            </details>
          )}

          <div className="grid-4" style={{ marginBottom: 14 }}>
            <div className="card kpi">
              <div className="lbl">Valor del almacén</div>
              <div className="val">{fmt(value)}</div>
              <div className="d">a costo de compra</div>
            </div>
            <div className="card kpi">
              <div className="lbl">Bajo mínimo</div>
              <div className="val" style={{ color: low.length ? 'var(--rojo)' : 'var(--verde)' }}>{low.length}</div>
              <div className="d">requieren pedido</div>
            </div>
            <div className="card kpi">
              <div className="lbl">Proveedor activo</div>
              <div className="val" style={{ fontSize: 18 }}>{settings?.provider === 'psm' ? 'PROSEALMASTER' : 'Marca nacional'}</div>
              <div className="d">{settings?.provider === 'psm' ? '−30% landed' : 'catálogo nacional'}</div>
            </div>
            <div className="card kpi">
              <div className="lbl">Productos</div>
              <div className="val">{items.length}</div>
              <div className="d">unidades reales (cubeta/rollo)</div>
            </div>
          </div>

          <div className="card tbl">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="num">Stock</th>
                  <th className="num">Mínimo</th>
                  <th className="num">Costo unit.</th>
                  <th>Proveedor</th>
                  <th>Estado</th>
                  <th className="num">Pedido propuesto</th>
                  <th>Movimiento</th>
                  {canEdit && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const st = i.stock <= 0 ? 'bad' : i.stock < i.min ? 'warn' : 'ok';
                  const suggested = i.stock < i.min ? Math.max(i.min * 2 - i.stock, 0) : 0;
                  return (
                    <tr key={i.id}>
                      <td>
                        <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
                          <SmartImage
                            className="img-thumb"
                            src={i.photo || inventoryImage(i.name, 480)}
                            fallback={inventorySvg(i.name)}
                            alt={i.name}
                          />
                          <div>
                            <b>{i.name}</b>
                            <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
                              <Link
                                className="btn sm ghost"
                                href={`/inventario?vista=consumos&item=${i.id}`}
                                title={`Consumo diario de ${i.name}`}
                              >
                                📅 Consumos
                              </Link>
                              <Link
                                className="btn sm ghost"
                                href={`/inventario?vista=movimientos&item=${i.id}`}
                                title={`Movimientos (kardex) de ${i.name}`}
                              >
                                📋 Movimientos
                              </Link>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="num">
                        {i.stock} {i.unitName}
                      </td>
                      <td className="num">{i.min}</td>
                      <td className="num">{fmt(i.cost * factor)}</td>
                      <td>{i.provider}</td>
                      <td>
                        <span className={`badge ${st}`}>{st === 'bad' ? 'Sin stock' : st === 'warn' ? 'Bajo mínimo' : 'OK'}</span>
                      </td>
                      <td className="num">{suggested ? <b>{suggested} {i.unitName}</b> : '—'}</td>
                      <td>
                        <form action={addStockAction} style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                          <input type="hidden" name="itemId" value={i.id} />
                          <input type="number" name="qty" defaultValue={i.min} min="0" step="0.01" style={{ width: 62 }} aria-label="Cantidad" required />
                          <select name="kind" defaultValue="ENTRADA" style={{ maxWidth: 96 }} aria-label="Tipo de movimiento">
                            <option value="ENTRADA">Entrada</option>
                            <option value="SALIDA">Salida</option>
                          </select>
                          <input name="docRef" placeholder="Factura / remisión" style={{ width: 132 }} aria-label="Factura o remisión" />
                          <button className="btn sm" type="submit">
                            Registrar
                          </button>
                        </form>
                        {suggested > 0 && (
                          <form action={suggestOrderAction} style={{ marginTop: 4 }}>
                            <input type="hidden" name="itemId" value={i.id} />
                            <button className="btn sm primary" type="submit">
                              Pedir
                            </button>
                          </form>
                        )}
                      </td>
                      {canEdit && (
                        <td>
                          <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                            <Link className="btn sm" href={`/inventario?foto=${i.id}`} title="Foto del producto">
                              📷
                            </Link>
                            <Link className="btn sm" href={`/inventario?edit=${i.id}`} title="Editar producto">
                              ✎ Editar
                            </Link>
                            <Link className="btn sm" style={{ color: 'var(--rojo)' }} href={`/inventario?del=${i.id}`} title="Eliminar producto">
                              🗑
                            </Link>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!canEdit && (
              <div className="mini" style={{ padding: '8px 14px' }}>
                Modo consulta: puedes registrar entradas y salidas, pero los datos maestros (nombre, costo, mínimo, proveedor, foto y
                eliminación) solo los cambia Gerencia o el desarrollador.
              </div>
            )}
          </div>
        </>
      )}

      {vista === 'consumos' && (
        <div className="card tbl">
          <div className="sec" style={{ padding: '14px 14px 0' }}>
            📅 Consumos diarios <span className="badge">salidas por fecha · estilo Excel</span>
            {filterItem && (
              <Link className="btn sm" href="/inventario?vista=consumos" style={{ marginLeft: 10 }}>
                ✕ Quitar filtro: {filterItem.name}
              </Link>
            )}
            <a className="btn sm primary" href="/api/inventario/export" style={{ marginLeft: 10 }} title="Incluye la hoja Consumos en el Excel">
              ⬇ Exportar a Excel
            </a>
          </div>
          <div className="mini" style={{ padding: '4px 14px 8px' }}>
            Cuánto se gastó de cada producto cada día (solo salidas): filas = productos, columnas = últimos 10 días con consumo. Cada
            producto tiene su acceso directo desde la pestaña Productos (📅 Consumos).
          </div>
          {consumoDays.length ? (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    {consumoDays.map((d) => (
                      <th key={d} className="num">
                        {dayLabel(d)}
                      </th>
                    ))}
                    <th className="num">Total período</th>
                  </tr>
                </thead>
                <tbody>
                  {consumoItems.map((i) => {
                    const row = consumoByItem.get(i.id);
                    const rowTotal = consumoDays.reduce((s, d) => s + (row?.get(d) || 0), 0);
                    return (
                      <tr key={i.id}>
                        <td>
                          <b>{i.name}</b>
                          <div className="mini">
                            Stock actual: {i.stock} {i.unitName}
                          </div>
                        </td>
                        {consumoDays.map((d) => {
                          const v = row?.get(d) || 0;
                          return (
                            <td key={d} className="num">
                              {v ? (
                                <span className="badge bad">
                                  −{v} {i.unitName}
                                </span>
                              ) : (
                                <span className="mini">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="num">{rowTotal ? <b>{rowTotal} {i.unitName}</b> : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="alert b" style={{ margin: 14 }}>
              Sin salidas registradas todavía. Cada salida que registres (con su factura o remisión) aparecerá aquí agrupada por fecha.
            </div>
          )}
        </div>
      )}

      {vista === 'kardex' && (
        <div className="card tbl">
          <div className="sec" style={{ padding: '14px 14px 0' }}>
            🧾 Kardex por producto <span className="badge">como Excel · cada columna es un movimiento</span>
            <a className="btn sm primary" href="/api/inventario/export" style={{ marginLeft: 10 }} title="Descargar inventario y kardex en Excel">
              ⬇ Exportar a Excel
            </a>
          </div>
          <div className="mini" style={{ padding: '4px 14px 8px' }}>
            Filas = productos, columnas = movimientos en orden (1, 2, 3…): verde entrada, rojo salida, con la remisión o factura que los
            respalda. Aquí se ven los últimos 12; en el Excel salen <b>todos</b> con colores.
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="num">Stock actual</th>
                  {kardexCols.map((m, idx) => (
                    <th key={m.id} className="num">
                      {kardexStart + idx} · {m.docRef || m.reason}
                      <div className="mini">{dateStr(m.createdAt)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const st = i.stock <= 0 ? 'bad' : i.stock < i.min ? 'warn' : 'ok';
                  const own = kardexByItem.get(i.id);
                  return (
                    <tr key={i.id}>
                      <td>
                        <b>{i.name}</b>
                      </td>
                      <td className="num">
                        <span className={`badge ${st}`}>
                          {i.stock} {i.unitName}
                        </span>
                      </td>
                      {kardexCols.map((m) => {
                        const mv = own?.get(m.id);
                        const salida = mv ? esSalida(mv) : false;
                        return (
                          <td key={m.id} className="num">
                            {mv ? (
                              <span className={`badge ${salida ? 'bad' : 'ok'}`}>
                                {salida ? '−' : '+'}
                                {Math.abs(mv.qty)} {i.unitName}
                              </span>
                            ) : (
                              <span className="mini">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {kardexTotal > kardexCols.length && (
            <div className="mini" style={{ padding: '8px 14px' }}>
              Mostrando los últimos {kardexCols.length} de {kardexTotal} movimientos · el Excel incluye el historial completo.
            </div>
          )}
        </div>
      )}

      {vista === 'movimientos' && (
        <div className="card tbl">
          <div className="sec" style={{ padding: '14px 14px 0' }}>
            📋 Movimientos del inventario <span className="badge">fecha · documento · saldo</span>
            {filterItem && (
              <Link className="btn sm" href="/inventario?vista=movimientos" style={{ marginLeft: 10 }}>
                ✕ Quitar filtro: {filterItem.name}
              </Link>
            )}
            <a className="btn sm" href="/api/inventario/export" style={{ marginLeft: 10 }}>
              ⬇ Excel
            </a>
          </div>
          <div className="mini" style={{ padding: '4px 14px 8px' }}>
            Desglose de cada movimiento: la factura o remisión que lo respalda, el usuario que lo registró y el saldo que dejó. Filtro
            rápido por producto:{' '}
            <Link href="/inventario?vista=movimientos">todos</Link>
            {items.slice(0, 8).map((i) => (
              <span key={i.id}>
                {' · '}
                <Link href={`/inventario?vista=movimientos&item=${i.id}`}>{i.name.split(' ').slice(0, 2).join(' ')}</Link>
              </span>
            ))}
          </div>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th>Tipo</th>
                <th className="num">Cantidad</th>
                <th className="num">Saldo</th>
                <th>Factura / remisión</th>
                <th>Motivo</th>
                <th>Usuario</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => {
                const it = itemMap.get(m.itemId);
                return (
                  <tr key={m.id}>
                    <td>
                      {dateFullStr(m.createdAt)}{' '}
                      <span className="mini">{timeStr(m.createdAt)}</span>
                    </td>
                    <td>
                      <b>{it?.name || 'Producto eliminado'}</b>
                    </td>
                    <td>
                      <span className={`badge ${esSalida(m) ? 'bad' : 'ok'}`}>{esSalida(m) ? 'SALIDA' : 'ENTRADA'}</span>
                    </td>
                    <td className="num">
                      {esSalida(m) ? '−' : '+'}
                      {Math.abs(m.qty)} {it?.unitName || ''}
                    </td>
                    <td className="num">{m.balance ?? '—'}</td>
                    <td>{m.docRef || '—'}</td>
                    <td className="mini">
                      {m.reason}
                      {m.otCode ? ` · ${m.otCode}` : ''}
                    </td>
                    <td className="mini">{m.userName || '—'}</td>
                  </tr>
                );
              })}
              {!movements.length && (
                <tr>
                  <td colSpan={8} className="mini">
                    Sin movimientos registrados todavía. Registra la primera entrada o salida desde la pestaña Productos (últimos 50
                    movimientos se muestran aquí).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {filterItem && (
            <div className="mini" style={{ padding: '8px 14px' }}>
              Mostrando solo movimientos de <b>{filterItem.name}</b> ·{' '}
              <Link href="/inventario?vista=movimientos">quitar filtro</Link>
            </div>
          )}
        </div>
      )}

      {vista === 'bitacora' && (
        <div className="card panel">
          <div className="sec">📜 Bitácora de modificaciones <span className="badge">quién cambió qué, con antes → después</span></div>
          {audit.map((a) => (
            <div className="rule" key={a.id}>
              <span className="ic info">i</span>
              <div>
                <b>{a.action}</b>
                {a.ref && <div className="mini">{a.ref}</div>}
                <div className="mini">
                  {dateTimeStr(a.createdAt)} · {a.userName || 'sistema'} · rol {a.role || '—'}
                </div>
              </div>
            </div>
          ))}
          {!audit.length && <div className="mini">Sin modificaciones registradas todavía: cada alta, cambio o movimiento aparecerá aquí.</div>}
        </div>
      )}

      <div className="mini" style={{ marginTop: 10 }}>
        El descuento por OT se registra al avanzar fases en Obra. La recepción real de material se captura aquí.
        <br />
        Fotografías: <Link href="/creditos" target="_blank">Unsplash · créditos</Link>
      </div>
    </>
  );
}
