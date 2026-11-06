import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import { fmt } from '@/lib/constants';
import { inventoryImage, inventorySvg } from '@/lib/images';
import SmartImage from '@/components/SmartImage';
import ProductPhotoManager from '@/components/ProductPhotoManager';
import Link from 'next/link';
import { addStockAction, suggestOrderAction, createProductAction, updateProductAction, deleteProductAction } from './actions';

export default async function InventarioPage({
  searchParams
}: {
  searchParams: Promise<{ msg?: string; err?: string; edit?: string; del?: string; foto?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const canCreate = ['ADMIN', 'CENTRAL', 'DEV', 'GERENCIA'].includes(user.role);
  const settings = await prisma.settings.findUnique({ where: { id: 'default' } });
  const items = await prisma.inventoryItem.findMany({ orderBy: { name: 'asc' } });

  const factor = settings?.provider === 'psm' ? 0.7 : 1;
  const value = items.reduce((x, i) => x + i.stock * i.cost * factor, 0);
  const low = items.filter((i) => i.stock < i.min);
  const editing = sp.edit ? items.find((i) => i.id === sp.edit) : undefined;
  const deleting = sp.del ? items.find((i) => i.id === sp.del) : undefined;
  const photoItem = sp.foto ? items.find((i) => i.id === sp.foto) : undefined;

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">Almacén</div>
          <h1>Inventario PROSEALMASTER</h1>
          <div className="sub">Stock, mínimos y pedido propuesto. La compra es exclusiva PROSEALMASTER: se ve precio de compra, no landed.</div>
        </div>
      </div>
      {sp.msg === 'movimiento' && <div className="alert g">Movimiento de inventario registrado.</div>}
      {sp.msg === 'pedido' && <div className="alert g">Pedido propuesto creado y avisado en la bandeja interna.</div>}
      {sp.msg === 'creado' && <div className="alert g">Producto creado y registrado en la bitácora y auditoría.</div>}
      {sp.msg === 'editado' && <div className="alert g">Producto actualizado y registrado en la bitácora.</div>}
      {sp.msg === 'eliminado' && <div className="alert g">Producto eliminado (con sus movimientos) y registrado en la bitácora.</div>}
      {sp.err === 'rol' && <div className="alert r">Solo Administración, Central, Gerencia o el desarrollador pueden crear productos.</div>}
      {sp.err === 'alta' && <div className="alert r">Completa al menos el nombre del producto.</div>}
      {sp.err === 'datos' && <div className="alert r">Cantidad inválida.</div>}
      {sp.err === 'noexiste' && <div className="alert r">Ese producto ya no existe.</div>}

      {editing && canCreate && (
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
              El stock se ajusta con “+ Entrada” o salidas directas en la tabla, para que quede el movimiento registrado.
            </div>
          </form>
        </div>
      )}

      {photoItem && canCreate && (
        <div className="card panel" style={{ marginBottom: 14, borderColor: 'var(--azul-100)' }}>
          <div className="sec">Foto del producto · {photoItem.name}</div>
          <ProductPhotoManager itemId={photoItem.id} name={photoItem.name} current={photoItem.photo} />
          <Link className="btn" href="/inventario" style={{ marginTop: 10 }}>
            Cerrar
          </Link>
        </div>
      )}

      {deleting && canCreate && (
        <div className="card panel" style={{ marginBottom: 14 }}>
          <div className="sec" style={{ color: 'var(--rojo)' }}>
            Eliminar producto
          </div>
          <p className="mini" style={{ marginBottom: 10 }}>
            Vas a eliminar <b>{deleting.name}</b> (stock {deleting.stock} {deleting.unitName}) y sus movimientos. Esta acción
            queda en la bitácora y no se puede deshacer.
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
              {canCreate && <th>Acciones</th>}
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
                      <b>{i.name}</b>
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
                    <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <form action={addStockAction} style={{ display: 'flex', gap: 4 }}>
                        <input type="hidden" name="itemId" value={i.id} />
                        <input type="number" name="qty" defaultValue={i.min} style={{ width: 64 }} aria-label="Cantidad" />
                        <button className="btn sm" type="submit">
                          + Entrada
                        </button>
                      </form>
                      {suggested > 0 && (
                        <form action={suggestOrderAction}>
                          <input type="hidden" name="itemId" value={i.id} />
                          <button className="btn sm primary" type="submit">
                            Pedir
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                  {canCreate && (
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
      </div>
      <div className="mini" style={{ marginTop: 10 }}>
        El descuento por OT se registra al avanzar fases en Obra. La recepción real de material se captura aquí.
        <br />
        Fotografías: <Link href="/creditos" target="_blank">Unsplash · créditos</Link>
      </div>
    </>
  );
}
