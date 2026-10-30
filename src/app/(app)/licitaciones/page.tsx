import { prisma } from '@/lib/prisma';
import { requireUser, getActiveUnitId } from '@/lib/session';
import { dateStr } from '@/lib/constants';
import { prefillTenderAction } from './actions';

export default async function LicitacionesPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const unitId = await getActiveUnitId(user);
  const scope = unitId ? { unitId } : {};
  const tenders = await prisma.tender.findMany({ where: scope, orderBy: { openingDate: 'asc' } });

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">CompraNet + estados</div>
          <h1>Licitaciones</h1>
          <div className="sub">El agente vigila portales y puntúa coincidencia con experiencia y certificaciones. Envío real: fase 2.</div>
        </div>
      </div>
      {sp.msg === 'prellenado' && <div className="alert g">Expediente pre-llenado. La documentación legal se firma fuera del sistema.</div>}

      <div className="card tbl">
        <table>
          <thead>
            <tr>
              <th>Convocante</th>
              <th>Objeto</th>
              <th>Apertura</th>
              <th className="num">Match</th>
              <th>Estado</th>
              <th></th>
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
                <td>
                  <span className={`badge ${t.status === 'PRELLENADA' ? 'info' : ''}`}>{t.status}</span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <form action={prefillTenderAction}>
                    <input type="hidden" name="tenderId" value={t.id} />
                    <button className="btn sm primary" type="submit">
                      Pre-llenar expediente
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {!tenders.length && (
              <tr>
                <td colSpan={6} className="mini">
                  Sin licitaciones registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card panel" style={{ marginTop: 14 }}>
        <div className="sec">Cómo funciona (sin inventar IA)</div>
        <div className="agent">
          <span className="ic">🏛️</span>
          <div className="t">
            <b>Agente de licitaciones</b> — vigila y puntúa coincidencia con tu catálogo y certificaciones. <span className="badge warn">No envía solo</span>
          </div>
        </div>
        <div className="agent">
          <span className="ic">📄</span>
          <div className="t">
            <b>Pre-llenado</b> — prepara el expediente con datos de la empresa y de obras similares. La firma y el sello quedan del lado humano.
          </div>
        </div>
        <div className="mini">
          Integración con CompraNet y portales estatales: fase 2. Hoy el registro es manual y el motor calcula coincidencia sobre la experiencia capturada.
        </div>
      </div>
    </>
  );
}
