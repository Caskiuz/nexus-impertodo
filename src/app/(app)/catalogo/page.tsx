import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import { fmt } from '@/lib/constants';
import { saveSettingsAction, saveCostSheetAction } from './actions';

export default async function CatalogoPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string; sys?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;

  const [systems, settings, sheets] = await Promise.all([
    prisma.system.findMany({ orderBy: { key: 'asc' } }),
    prisma.settings.findUnique({ where: { id: 'default' } }),
    prisma.costSheet.findMany()
  ]);

  const floor = settings?.floor ?? 30;
  const indirect = settings?.indirect ?? 8;
  const factor = settings?.provider === 'psm' ? 0.7 : 1;
  const selKey = sp.sys || systems[0]?.key || 'acr10';
  const selSheet = sheets.find((s) => s.systemKey === selKey);
  const sheetMap = new Map(sheets.map((s) => [s.systemKey, s]));

  const messages: Record<string, string> = {
    guardado: 'Parámetros guardados. Todo el cotizador hereda estos números.',
    ficha: 'Ficha de costos guardada. La aprobación de cotizaciones ya puede documentarse.'
  };
  const errors: Record<string, string> = {
    rol: 'Solo Administración o Central pueden editar el catálogo.',
    evidencia: 'Completa proveedor, folio/referencia y ficha técnica.',
    sistema: 'Sistema inválido.'
  };

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">Motor de precios</div>
          <h1>Catálogo y márgenes</h1>
          <div className="sub">La verdad del negocio: material en unidades reales, destajo, merma, indirectos y piso de margen. Todo cotizador hereda estos números.</div>
        </div>
      </div>
      {sp.msg && <div className="alert g">{messages[sp.msg] || 'Listo.'}</div>}
      {sp.err && <div className="alert r">{errors[sp.err] || 'Error.'}</div>}

      <form action={saveSettingsAction} className="grid-4" style={{ marginBottom: 14 }}>
        <div className="card panel">
          <div className="field" style={{ margin: 0 }}>
            <label>Piso de margen (%)</label>
            <input type="number" name="floor" defaultValue={floor} min={0} max={90} />
          </div>
        </div>
        <div className="card panel">
          <div className="field" style={{ margin: 0 }}>
            <label>Indirectos (%)</label>
            <input type="number" name="indirect" defaultValue={indirect} min={0} max={100} />
          </div>
        </div>
        <div className="card panel">
          <div className="field" style={{ margin: 0 }}>
            <label>Proveedor de material</label>
            <select name="provider" defaultValue={settings?.provider || 'nac'}>
              <option value="nac">Marca nacional</option>
              <option value="psm">PROSEALMASTER (−30% landed)</option>
            </select>
          </div>
        </div>
        <div className="card panel" style={{ display: 'grid', placeItems: 'center' }}>
          <button className="btn primary" type="submit" style={{ width: '100%' }}>
            Guardar parámetros
          </button>
        </div>
      </form>

      <div className="card tbl">
        <table>
          <thead>
            <tr>
              <th>Sistema</th>
              <th className="num">Consumo</th>
              <th className="num">Mat. $/m²</th>
              <th className="num">Destajo</th>
              <th className="num">Merma</th>
              <th className="num">Vida · gar.</th>
              <th className="num">Lista</th>
              <th className="num">Promo</th>
              <th className="num">Mínimo</th>
              <th className="num">Margen promo</th>
              <th>Ficha</th>
            </tr>
          </thead>
          <tbody>
            {systems.map((s) => {
              const matm2 = ((s.cons * (1 + s.waste)) / s.pack) * s.packPrice * factor;
              const cost = (matm2 + s.labor + s.cons2) * (1 + indirect / 100);
              const margin = (s.promo - cost) / s.promo;
              const min = cost / (1 - floor / 100);
              const cls = margin * 100 >= floor ? 'ok' : margin * 100 >= floor - 7 ? 'warn' : 'bad';
              const sheet = sheetMap.get(s.key);
              return (
                <tr key={s.key}>
                  <td>
                    <b>{s.short}</b>
                    <div className="mini">{s.name}</div>
                  </td>
                  <td className="num">
                    {s.cons} {s.unit === 'L' ? 'L/m²' : s.unit === 'm2' ? 'm²/m²' : 'kg/m²'}
                  </td>
                  <td className="num">{fmt(matm2)}</td>
                  <td className="num">{fmt(s.labor)}</td>
                  <td className="num">{Math.round(s.waste * 100)}%</td>
                  <td className="num">
                    {s.life} · {s.warranty} a
                  </td>
                  <td className="num">{fmt(s.list)}</td>
                  <td className="num">
                    <b>{fmt(s.promo)}</b>
                  </td>
                  <td className="num" style={{ color: 'var(--verde-600)' }}>
                    {fmt(min)}
                  </td>
                  <td className="num">
                    <span className={`semaforo ${cls}`} style={{ fontSize: 14 }}>
                      {(margin * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td>
                    {sheet?.confirmed ? (
                      <a className="badge ok" href={`/catalogo?sys=${s.key}`}>
                        Documentada
                      </a>
                    ) : (
                      <a className="badge warn" href={`/catalogo?sys=${s.key}`}>
                        Registrar
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mini" style={{ padding: 10 }}>
          Precios de venta históricos 2025–2026. Costos y mermas editables con evidencia. &quot;Mínimo&quot; = precio con el piso de margen.
        </div>
      </div>

      <div className="two" style={{ marginTop: 14 }}>
        <form action={saveCostSheetAction} className="card panel">
          <div className="sec">Ficha maestra de costos</div>
          <div className="row2">
            <div className="field">
              <label>Sistema</label>
              <select name="systemKey" defaultValue={selKey}>
                {systems.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.short}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Proveedor / fabricante</label>
              <input name="supplier" defaultValue={selSheet?.supplier || ''} placeholder="Proveedor que cotizó o facturó" />
            </div>
            <div className="field">
              <label>Material ($/m²)</label>
              <input name="material" type="number" step="0.01" defaultValue={selSheet?.material ?? ''} />
            </div>
            <div className="field">
              <label>Mano de obra ($/m²)</label>
              <input name="labor" type="number" step="0.01" defaultValue={selSheet?.labor ?? ''} />
            </div>
            <div className="field">
              <label>Preparación e insumos ($/m²)</label>
              <input name="prep" type="number" step="0.01" defaultValue={selSheet?.prep ?? ''} />
            </div>
            <div className="field">
              <label>Merma adicional (%)</label>
              <input name="waste" type="number" step="0.1" defaultValue={selSheet?.waste ?? 8} />
            </div>
            <div className="field">
              <label>Folio factura / cotización y fecha</label>
              <input name="source" defaultValue={selSheet?.source || ''} placeholder="Ej. CFDI ABC-123 / 2026-10-22" />
            </div>
            <div className="field">
              <label>Ficha técnica (identificador/versión)</label>
              <input name="technical" defaultValue={selSheet?.technical || ''} placeholder="Ej. SBS-45 / rev 2026" />
            </div>
          </div>
          <label className="switch" style={{ marginTop: 10 }}>
            <input type="checkbox" name="confirmed" defaultChecked={selSheet?.confirmed} /> Confirmo que revisé costo y especificaciones contra documentación vigente.
          </label>
          <button className="btn primary" type="submit" style={{ marginTop: 10 }}>
            Guardar ficha de costos
          </button>
        </form>

        <div className="card panel">
          <div className="sec">Regla técnica</div>
          <div className="rule">
            <span className="ic ok">✓</span>
            <div>Un costo de venta no es el costo del material: compra, rendimiento útil, mano de obra, mermas y viáticos van separados.</div>
          </div>
          <div className="rule">
            <span className="ic warn">!</span>
            <div>En SBS el espesor debe ser coherente entre título y procedimiento (4.5 mm vs 3.5 mm fue un error real detectado).</div>
          </div>
          <div className="rule">
            <span className="ic info">i</span>
            <div>&quot;10 años&quot; en el envase no equivale a garantía contractual: la propuesta explica la diferencia.</div>
          </div>
          <div className="sec" style={{ marginTop: 14 }}>
            Fichas registradas
          </div>
          {sheets.map((s) => (
            <div className="rule" key={s.id}>
              <span className={`ic ${s.confirmed ? 'ok' : 'warn'}`}>{s.confirmed ? '✓' : '!'}</span>
              <div>
                <b>{s.systemKey}</b> · {s.supplier || 'pendiente'}
                <div className="mini">
                  {s.confirmed ? 'Ficha declarada revisada' : 'NO VERIFICADA'} · {s.source || 'sin referencia'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
