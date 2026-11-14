import { prisma } from '@/lib/prisma';
import { requireUser, getActiveUnitId } from '@/lib/session';
import { fmt, dateStr } from '@/lib/constants';
import { serviceImage, serviceSvg } from '@/lib/images';
import SmartImage from '@/components/SmartImage';
import ModuleExplainer from '@/components/ModuleExplainer';
import Link from 'next/link';
import { estimateLeadAction, startSequenceAction, evaluateRadarAction, radarToLeadAction } from './actions';

interface RadarRow {
  id: string;
  name: string;
  sector: string;
  areaM2: number | null;
  notes: string | null;
  score: number;
  analysis: string | null;
  sequence: string | null;
  demo?: boolean;
}

const DEMO_RADAR: RadarRow[] = [
  { id: 'demo-1', name: 'Nave logística · Parque Industrial Lagunero', sector: 'Industrial', areaM2: 6800, notes: 'Lámina con óxido · gerente de mantto en LinkedIn', score: 94, analysis: 'Cuenta de ejemplo. Evalúa una cuenta real para guardarla en tu radar.', sequence: null, demo: true },
  { id: 'demo-2', name: 'Plaza comercial · Blvd. Independencia', sector: 'Comercial', areaM2: 3200, notes: 'Charcos en imagen de agosto', score: 88, analysis: 'Cuenta de ejemplo. Evalúa una cuenta real para guardarla en tu radar.', sequence: null, demo: true },
  { id: 'demo-3', name: 'Secundaria técnica SEP', sector: 'Gobierno / Salud', areaM2: 2100, notes: 'Licitación probable 2027', score: 76, analysis: 'Cuenta de ejemplo. Evalúa una cuenta real para guardarla en tu radar.', sequence: null, demo: true }
];

export default async function CaptacionPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string; lo?: string; hi?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const unitId = await getActiveUnitId(user);
  const scope = unitId ? { unitId } : {};
  const tenders = await prisma.tender.findMany({ where: scope, orderBy: { openingDate: 'asc' } });
  const radarEntries = await prisma.radarEntry.findMany({ orderBy: { score: 'desc' } });
  const radarRows: RadarRow[] = radarEntries.length ? radarEntries : DEMO_RADAR;

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">Entradas al embudo</div>
          <h1>Captación</h1>
          <div className="sub">Estimador público, WhatsApp con IA (fase 2) y radar de techos para cuentas grandes.</div>
        </div>
      </div>
      <ModuleExplainer
        points={[
          'Este módulo es la entrada de clientes nuevos: todo lo que se captura aquí aparece en el embudo de Clientes & Techos.',
          'Estimador web: el cliente pone su tipo de techo y los m² en impertodopro.com/cotiza y recibe un rango de precio; el lead se crea solo.',
          'WhatsApp con IA (fase 2): responderá 24/7 pidiendo fotos y agendando visitas; hoy es demo hasta integrar la API oficial de Meta.',
          'Radar de techos: detecta cuentas grandes con techo en mal estado y les da una puntuación 0-100 para atacar primero las mejores.',
          'Licitaciones: convocatorias de gobierno que coinciden con tu giro, con fecha de apertura y % de coincidencia.',
          'Te sirve si: quieres llenar el embudo sin depender solo de referidos — evalúa cuentas con IA y crea prospectos en un clic.'
        ]}
      />
      {sp.msg === 'lead' && (
        <div className="alert g">
          Estimado: {sp.lo && sp.hi ? `${fmt(parseInt(sp.lo, 10))} – ${fmt(parseInt(sp.hi, 10))}` : 'listo'} + IVA. Lead creado en Clientes · etapa Nuevo.
        </div>
      )}
      {sp.msg === 'secuencia' && <div className="alert g">Secuencia de 3 toques creada (envío manual).</div>}
      {sp.msg === 'radar' && <div className="alert g">Cuenta evaluada y guardada en el radar de techos.</div>}
      {sp.msg === 'radarlead' && <div className="alert g">Prospecto creado desde el radar: ya está en el embudo de Clientes (etapa Nuevo).</div>}
      {sp.err === 'm2' && <div className="alert r">Indica los m² aproximados.</div>}
      {sp.err === 'radar' && <div className="alert r">Escribe el nombre de la cuenta a evaluar.</div>}
      {sp.err === 'radar404' && <div className="alert r">Esa cuenta del radar ya no existe.</div>}

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
          <div className="svc-grid">
            {['Azotea de casa', 'Azotea comercial / oficina', 'Nave industrial', 'Cisterna'].map((t) => (
              <figure className="svc" key={t}>
                <SmartImage src={serviceImage(t, 480)} fallback={serviceSvg(t)} alt={t} />
                <figcaption>{t}</figcaption>
              </figure>
            ))}
          </div>
          <div className="photo-credit">
            Fotografías:{' '}
            <Link href="/creditos" target="_blank">
              Unsplash · créditos
            </Link>
          </div>
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
          <div className="mini" style={{ marginBottom: 8 }}>
            Cuentas grandes con techo en mal estado, puntuadas 0-100 por IA. Ataca primero el score más alto.
          </div>
          {radarRows.map((r) => (
            <div className="rule" key={r.id}>
              <span className={`ic ${r.score >= 85 ? 'ok' : r.score >= 70 ? 'warn' : 'info'}`}>{r.score}</span>
              <div style={{ flex: 1 }}>
                <b>{r.name}</b>
                <div className="mini">
                  {r.areaM2 ? `≈ ${r.areaM2.toLocaleString('es-MX')} m² · ` : ''}
                  {r.sector}
                  {r.notes ? ` · ${r.notes}` : ''}
                </div>
                {r.analysis && <div className="mini" style={{ marginTop: 2 }}>{r.analysis}</div>}
                {r.sequence && <div className="mini" style={{ marginTop: 2 }}>{r.sequence}</div>}
              </div>
              <form action={startSequenceAction}>
                <input type="hidden" name="company" value={r.name} />
                <button className="btn sm" type="submit">
                  Secuencia
                </button>
              </form>
              {!r.demo && (
                <form action={radarToLeadAction}>
                  <input type="hidden" name="entryId" value={r.id} />
                  <button className="btn sm primary" type="submit" title="Crear prospecto en el embudo de Clientes">
                    + Prospecto
                  </button>
                </form>
              )}
            </div>
          ))}
          {!radarEntries.length && (
            <div className="mini" style={{ marginTop: 6 }}>
              Estas 3 cuentas son de ejemplo. Evalúa una cuenta real abajo: la IA la puntúa, guarda en tu radar y la conviertes en prospecto.
            </div>
          )}
        </div>
      </div>

      <details className="card panel" style={{ marginTop: 14 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 800, color: 'var(--azul-700)' }}>🔎 Evaluar cuenta para el radar (IA)</summary>
        <form action={evaluateRadarAction} style={{ marginTop: 12 }}>
          <div className="row3">
            <div className="field">
              <label>Nombre de la cuenta</label>
              <input name="name" required placeholder="Ej. Nave · Parque Industrial Lagunero" />
            </div>
            <div className="field">
              <label>Sector</label>
              <select name="sector">
                <option>Comercial</option>
                <option>Industrial</option>
                <option>Gobierno / Salud</option>
                <option>Residencial</option>
                <option>Minero</option>
              </select>
            </div>
            <div className="field">
              <label>m² aprox.</label>
              <input name="areaM2" type="number" min="0" placeholder="0" />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Notas del levantamiento (óxido, charcos, contacto, fuente)</label>
              <input
                name="notes"
                placeholder="Ej. lámina con óxido en fotos de Google Maps · gerente de mantenimiento en LinkedIn"
              />
            </div>
          </div>
          <button className="btn primary" type="submit">
            Evaluar con IA y guardar en el radar
          </button>
          <span className="mini" style={{ marginLeft: 10 }}>
            Sin API key se evalúa con reglas fijas (sin costo). El resultado queda guardado y puedes convertirlo en prospecto.
          </span>
        </form>
      </details>

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
