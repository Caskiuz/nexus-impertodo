import { prisma } from '@/lib/prisma';
import { requireUser, getActiveUnitId } from '@/lib/session';
import { fmt, dateStr } from '@/lib/constants';
import { estimateLeadAction, startSequenceAction } from './actions';

export default async function CaptacionPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string; lo?: string; hi?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const unitId = await getActiveUnitId(user);
  const scope = unitId ? { unitId } : {};
  const tenders = await prisma.tender.findMany({ where: scope, orderBy: { openingDate: 'asc' } });

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">Entradas al embudo</div>
          <h1>Captación</h1>
          <div className="sub">Estimador público, WhatsApp con IA (fase 2) y radar de techos para cuentas grandes.</div>
        </div>
      </div>
      {sp.msg === 'lead' && (
        <div className="alert g">
          Estimado: {sp.lo && sp.hi ? `${fmt(parseInt(sp.lo, 10))} – ${fmt(parseInt(sp.hi, 10))}` : 'listo'} + IVA. Lead creado en Clientes · etapa Nuevo.
        </div>
      )}
      {sp.msg === 'secuencia' && <div className="alert g">Secuencia de 3 toques creada (envío manual).</div>}
      {sp.err === 'm2' && <div className="alert r">Indica los m² aproximados.</div>}

      <div className="grid-3">
        <div className="card panel">
          <div className="sec">Estimador web</div>
          <div className="mini" style={{ marginBottom: 8 }}>impertodopro.com/cotiza · crea el lead al calcular</div>
          <form action={estimateLeadAction}>
            <div className="field">
              <label>¿Qué quieres impermeabilizar?</label>
              <select name="tipo">
                <option>Azotea de casa</option>
                <option>Azotea comercial / oficina</option>
                <option>Nave industrial</option>
                <option>Cisterna</option>
              </select>
            </div>
            <div className="field">
              <label>m² aprox.</label>
              <input name="m2" type="number" defaultValue={250} min={1} required />
            </div>
            <div className="field">
              <label>WhatsApp</label>
              <input name="phone" placeholder="10 dígitos" />
            </div>
            <button className="btn primary" type="submit" style={{ width: '100%' }}>
              Ver estimado y crear lead
            </button>
          </form>
        </div>

        <div className="card panel">
          <div className="sec">WhatsApp con IA</div>
          <div className="mini">Responde 24/7, pide fotos, pre-cotiza y agenda. Fase 2 con API oficial de Meta.</div>
          <div className="alert b" style={{ marginTop: 10 }}>
            &quot;Veo acrílico despegado y un charco junto al bajante. Rango: acrílico 10 años $169–199/m² o rollo SBS 10 años de garantía $329–390/m² (+IVA). ¿Visita sin costo viernes 9:00 o 16:00?&quot;
          </div>
          <div className="alert g">Listo ✅ viernes 9:00. El supervisor confirma medidas y te manda propuesta el mismo día.</div>
          <div className="mini">→ Prospecto creado · etapa Levantamiento · fuente WhatsApp (demo).</div>
        </div>

        <div className="card panel">
          <div className="sec">Radar de techos</div>
          {[
            { s: '94', t: 'Nave logística · Parque Industrial Lagunero', d: '≈ 6,800 m² · lámina con óxido · gerente de mantto en LinkedIn', cls: 'ok' },
            { s: '88', t: 'Plaza comercial · Blvd. Independencia', d: '≈ 3,200 m² · charcos en imagen de agosto', cls: 'ok' },
            { s: '76', t: 'Secundaria técnica SEP', d: '≈ 2,100 m² · licitación probable 2027', cls: 'warn' }
          ].map((r) => (
            <div className="rule" key={r.t}>
              <span className={`ic ${r.cls}`}>{r.s}</span>
              <div style={{ flex: 1 }}>
                <b>{r.t}</b>
                <div className="mini">{r.d}</div>
              </div>
              <form action={startSequenceAction}>
                <input type="hidden" name="company" value={r.t} />
                <button className="btn sm" type="submit">
                  Secuencia
                </button>
              </form>
            </div>
          ))}
        </div>
      </div>

      <div className="card tbl" style={{ marginTop: 14 }}>
        <div className="sec" style={{ padding: '14px 14px 0' }}>
          Licitaciones detectadas <span className="badge">CompraNet + estados</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Convocante</th>
              <th>Objeto</th>
              <th>Apertura</th>
              <th className="num">Coincidencia</th>
            </tr>
          </thead>
          <tbody>
            {tenders.map((t) => (
              <tr key={t.id}>
                <td>
                  <b>{t.convener}</b>
                </td>
                <td>{t.object}</td>
                <td>{dateStr(t.openingDate)}</td>
                <td className="num">
                  <span className={`badge ${t.match >= 90 ? 'ok' : 'warn'}`}>{t.match}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
