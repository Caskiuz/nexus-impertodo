import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import { fmt } from '@/lib/constants';
import { inventoryImage, inventorySvg } from '@/lib/images';
import SmartImage from '@/components/SmartImage';
import Link from 'next/link';
import { addStockAction, suggestOrderAction } from './actions';

export default async function InventarioPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const settings = await prisma.settings.findUnique({ where: { id: 'default' } });
  const items = await prisma.inventoryItem.findMany({ orderBy: { name: 'asc' } });

  const factor = settings?.provider === 'psm' ? 0.7 : 1;
  const value = items.reduce((x, i) => x + i.stock * i.cost * factor, 0);
  const low = items.filter((i) => i.stock < i.min);

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
      {sp.err === 'datos' && <div className="alert r">Cantidad inválida.</div>}

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
                      <SmartImage className="img-thumb" src={inventoryImage(i.name, 480)} fallback={inventorySvg(i.name)} alt={i.name} />
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
