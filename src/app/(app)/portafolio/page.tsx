import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import { dateStr } from '@/lib/constants';
import PortfolioUploader from '@/components/PortfolioUploader';
import ModuleExplainer from '@/components/ModuleExplainer';
import { deletePortfolioEntryAction } from './actions';

export default async function PortafolioPage({
  searchParams
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const canDelete = ['GERENCIA', 'DEV'].includes(user.role);
  const entries = await prisma.portfolioEntry.findMany({ orderBy: { createdAt: 'desc' } });

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">Vitrina de trabajos</div>
          <h1>Portafolio</h1>
          <div className="sub">Evidencia del antes y después por cliente y tipo de techo. Sirve para vender: muéstralo a cuentas nuevas.</div>
        </div>
      </div>
      <ModuleExplainer
        points={[
          'Es tu vitrina de trabajos reales: cada entrada muestra la foto del ANTES (daño) junto a la del DESPUÉS (obra terminada).',
          'Sube la evidencia al entregar una obra (desde Obra/OT) o directamente aquí, con cliente y tipo de área (losa, lámina, muro…).',
          'Las fotos se comprimen solas al subirlas, desde la PC o la cámara del celular.',
          'Cuando prospectes una cuenta grande (radar de techos), abre el portafolio y muéstrale trabajos parecidos al suyo: vende más que cualquier argumento.',
          'Te sirve si: quieres acumular prueba social de tus trabajos y usarla en cada venta.'
        ]}
      />
      {sp.msg === 'eliminada' && <div className="alert g">Evidencia eliminada del portafolio (queda en bitácora).</div>}
      {sp.err === 'autoriza' && <div className="alert r">Solo Gerencia o el desarrollador pueden eliminar evidencia del portafolio.</div>}
      {sp.err === 'noexiste' && <div className="alert r">Esa entrada ya no existe.</div>}

      <details className="card panel" style={{ marginBottom: 14 }} open={!entries.length}>
        <summary style={{ cursor: 'pointer', fontWeight: 800, color: 'var(--azul-700)' }}>+ Subir evidencia antes/después</summary>
        <div style={{ marginTop: 12 }}>
          <PortfolioUploader />
        </div>
      </details>

      {entries.length === 0 ? (
        <div className="alert y">
          Aún no hay evidencia en el portafolio. Sube la primera con el formulario de arriba, o publica desde Obra al entregar una OT.
        </div>
      ) : (
        <div className="grid-2">
          {entries.map((e) => (
            <div className="card panel" key={e.id}>
              <div className="sec">
                {e.clientName}
                <span className="badge">{e.element}</span>
                {e.otCode && <span className="badge info">{e.otCode}</span>}
              </div>
              {e.title && <div className="mini" style={{ marginBottom: 6 }}>{e.title}</div>}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <figure style={{ margin: 0, flex: 1, minWidth: 140 }}>
                  {e.before ? (
                    <img
                      src={e.before}
                      alt={`Antes · ${e.clientName}`}
                      style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--linea)' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: 150,
                        borderRadius: 8,
                        border: '1px dashed var(--linea)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--gris)'
                      }}
                    >
                      Sin foto del antes
                    </div>
                  )}
                  <figcaption className="mini">ANTES · {dateStr(e.createdAt)}</figcaption>
                </figure>
                <figure style={{ margin: 0, flex: 1, minWidth: 140 }}>
                  {e.after ? (
                    <img
                      src={e.after}
                      alt={`Después · ${e.clientName}`}
                      style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--linea)' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: 150,
                        borderRadius: 8,
                        border: '1px dashed var(--linea)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--gris)'
                      }}
                    >
                      Sin foto del después
                    </div>
                  )}
                  <figcaption className="mini">DESPUÉS · obra terminada</figcaption>
                </figure>
              </div>
              {canDelete && (
                <form action={deletePortfolioEntryAction} style={{ marginTop: 8 }}>
                  <input type="hidden" name="id" value={e.id} />
                  <button className="btn sm" type="submit" style={{ color: 'var(--rojo)' }}>
                    🗑 Eliminar
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
