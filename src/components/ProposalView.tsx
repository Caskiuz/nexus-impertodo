import { prisma } from '@/lib/prisma';
import { computeQuote, type QuoteInput, type SystemDef } from '@/lib/calc';
import { fmt, fmt2, isoDate } from '@/lib/constants';
import { systemImage } from '@/lib/images';
import PhotoCredit from './PhotoCredit';
import PrintButton from './PrintButton';
import CopyLink from './CopyLink';
import { chooseOptionAction, approveProposalAction } from '@/actions/public';

export default async function ProposalView({ folio, mode }: { folio: string; mode: 'public' | 'internal' }) {
  const quote = await prisma.quote.findFirst({
    where: { folio },
    include: { extras: true, events: { orderBy: { createdAt: 'desc' }, take: 12 } }
  });
  if (!quote) {
    return <div className="alert r">Propuesta no encontrada. Verifica el enlace.</div>;
  }

  const systems = await prisma.system.findMany();
  const sysMap = new Map(systems.map((s) => [s.key, s as unknown as SystemDef]));

  const base: QuoteInput = {
    planta: quote.planta,
    perim: quote.perim,
    alt: quote.alt,
    baj: quote.baj,
    dom: quote.dom,
    duc: quote.duc,
    optA: quote.optA,
    optB: quote.optB,
    selected: quote.selected === 'A' ? 'A' : 'B',
    priceMode: quote.priceMode,
    marginTarget: quote.marginTarget,
    discount: quote.discount,
    floor: quote.floor,
    indirect: quote.indirect,
    provider: quote.provider,
    access: quote.access,
    moving: quote.moving,
    billing: quote.billing === 'si',
    extras: quote.extras
  };

  const sysA = sysMap.get(quote.optA) || systems[0];
  const sysB = sysMap.get(quote.optB) || systems[1];
  const selSys = quote.selected === 'A' ? sysA : sysB;
  const cA = computeQuote(sysA as SystemDef, base);
  const cB = computeQuote(sysB as SystemDef, base);
  const sel = computeQuote(selSys as SystemDef, base);
  const chosen = computeQuote((sysMap.get(quote.selected === 'A' ? quote.optA : quote.optB) || sysA) as SystemDef, base);

  const canAct = quote.status === 'ENVIADA' || quote.status === 'BORRADOR';

  return (
    <>
      <div className="grid-2">
        <div className="phone">
          <div className="scr">
            <div className="hdr">
              <div className="eyebrow" style={{ opacity: 0.8 }}>
                IMPERTODO · 45 años
              </div>
              <h3 style={{ fontSize: 22, marginTop: 4 }}>Propuesta para {quote.clientName}</h3>
              <p style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                {quote.address || 'Obra por confirmar'} · {isoDate(quote.createdAt)}
              </p>
            </div>

            {quote.diagnosed ? (
              <p style={{ fontSize: 12 }}>
                Detectamos agua estancada al NE y acrílico despegado en ~15% de la losa. Sobreponer sin corregir repite la gotera en 1–2 lluvias.
              </p>
            ) : (
              <p style={{ fontSize: 12 }}>
                Propuesta para {quote.element.toLowerCase()} de {cA.area.dev.toFixed(0)} m² desarrollados. Cotización a reserva de verificar área en sitio.
              </p>
            )}

            {[
              { letter: 'B' as const, sys: sysB, comp: cB, label: 'Recomendada' },
              { letter: 'A' as const, sys: sysA, comp: cA, label: 'Económica' }
            ].map(({ letter, sys, comp, label }) => (
              <div className={`propopt ${quote.selected === letter ? 'pick' : ''}`} key={letter}>
                <img className="prop-img" src={systemImage(sys.key, 900)} alt={sys.name} />
                <PhotoCredit kind="system" id={sys.key} />
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <b style={{ fontSize: 13 }}>
                    {label} · {sys.short}
                  </b>
                  <span className="badge ok">{sys.warranty} años garantía</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span className="mini">Vida útil {sys.life} años</span>
                  <b>{fmt(comp.total)}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span className="mini">Costo por m² por año</span>
                  <b>{fmt(comp.perYearValue)}</b>
                </div>
                {mode === 'public' && canAct && (
                  <form action={chooseOptionAction}>
                    <input type="hidden" name="folio" value={quote.folio} />
                    <input type="hidden" name="choice" value={letter} />
                    <button className={`btn sm ${letter === 'B' ? 'primary' : ''}`} type="submit" style={{ width: '100%' }}>
                      Elegir esta
                    </button>
                  </form>
                )}
              </div>
            ))}

            <div className="mini">
              Esquema {selSys.pago} · Vigencia 30 días · {quote.billing === 'si' ? 'IVA desglosado' : 'Precio neto sin factura'}
              {!quote.verified && ' · A reserva de verificar área'}
            </div>

            <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--linea)', paddingTop: 10, flexWrap: 'wrap' }}>
              <span className="badge ok">Anticipo {selSys.pago.split('/')[0]}%</span>
              {mode === 'public' && canAct ? (
                <form action={approveProposalAction}>
                  <input type="hidden" name="folio" value={quote.folio} />
                  <button className="btn azul sm" type="submit">
                    Aprobar propuesta
                  </button>
                </form>
              ) : (
                <span className="badge info">Propuesta {quote.status.toLowerCase()}</span>
              )}
            </div>
            <div className="mini">
              Sin cobro en línea: el anticipo se solicita por transferencia y se registra manualmente en Caja. Fase 2: pasarela de pagos.
            </div>
            <div className="photo-credit">
              Fotografías:{' '}
              <a href="/creditos" target="_blank" rel="noreferrer">
                Unsplash · créditos
              </a>
            </div>
          </div>
        </div>

        <div className="stack">
          {mode === 'public' ? (
            <div className="card panel">
              <div className="sec">¿Qué sigue?</div>
              <div className="rule">
                <span className="ic ok">✓</span>
                <div>Elige la opción que prefieras y aprueba la propuesta. Te contactamos para confirmar la visita y el anticipo.</div>
              </div>
              <div className="rule">
                <span className="ic info">i</span>
                <div>Garantía por escrito. Cada apertura de este enlace queda registrada para tu asesor.</div>
              </div>
              <div className="rule">
                <span className="ic warn">!</span>
                <div>Vigencia 30 días naturales. Precios en MXN {quote.billing === 'si' ? '+ IVA' : 'netos'}.</div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <PrintButton label="Descargar PDF" />
              </div>
            </div>
          ) : (
            <>
              <div className="card panel">
                <div className="sec">Lo que ve Impertodo</div>
                {quote.events.length === 0 && <div className="alert b">Sin actividad todavía. Cada apertura se registra.</div>}
                {quote.events.map((ev) => (
                  <div className="rule" key={ev.id}>
                    <span className={`ic ${ev.type === 'APPROVED' ? 'ok' : ev.type === 'OPEN' ? 'info' : 'warn'}`}>
                      {ev.type === 'APPROVED' ? '✓' : ev.type === 'OPEN' ? 'i' : '!'}
                    </span>
                    <div>
                      <b>{ev.type}</b> · {ev.detail || '—'}
                      <div className="mini">{ev.createdAt.toLocaleString('es-MX')}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="card panel">
                <div className="sec">Enlace público</div>
                <div className="mono" style={{ wordBreak: 'break-all', marginBottom: 8 }}>
                  /p/{quote.folio}
                </div>
                <CopyLink path={`/p/${quote.folio}`} />
                <div style={{ marginTop: 10 }}>
                  <a className="btn sm" href={`/p/${quote.folio}`} target="_blank">
                    Abrir en pestaña nueva ↗
                  </a>
                </div>
              </div>
              <div className="card panel">
                <div className="sec">Resumen financiero</div>
                <div className="sumline">
                  <span>Área desarrollada</span>
                  <b>{chosen.area.dev.toFixed(1)} m²</b>
                </div>
                <div className="sumline">
                  <span>Precio / m²</span>
                  <b>{fmt(chosen.unitPrice)}</b>
                </div>
                <div className="sumline">
                  <span>Partidas previas</span>
                  <b>{fmt(chosen.extrasSum)}</b>
                </div>
                <div className="sumline">
                  <span>Subtotal</span>
                  <b>{fmt(chosen.sub)}</b>
                </div>
                <div className="sumline">
                  <span>IVA</span>
                  <b>{fmt(chosen.iva)}</b>
                </div>
                <div className="sumline total">
                  <span>Total</span>
                  <b>{fmt(chosen.total)}</b>
                </div>
                <div className="sumline">
                  <span>Margen</span>
                  <b className={`semaforo ${chosen.semaforo}`} style={{ fontSize: 15 }}>
                    {(chosen.margin * 100).toFixed(0)}%
                  </b>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Plantilla oficial imprimible */}
      <div className="print-only proposal-doc">
        <div className="title">{selSys.name}</div>
        <div className="cot">C O T I Z A C I Ó N</div>
        <table>
          <tbody>
            <tr>
              <td>
                <b>EMPRESA / CLIENTE:</b> {quote.clientName}
              </td>
              <td>
                <b>FECHA:</b> {isoDate(quote.createdAt)}
              </td>
            </tr>
            <tr>
              <td>
                <b>ATENCIÓN:</b> {quote.contact || '—'}
              </td>
              <td>
                <b>OBRA:</b> {quote.address || '—'}
              </td>
            </tr>
            <tr>
              <td>TORREÓN, COAHUILA · WhatsApp: {quote.phone || '—'}</td>
              <td>impertodopro.com · Fb: Impertodotrc</td>
            </tr>
          </tbody>
        </table>
        <p style={{ fontSize: 13, margin: '14px 0' }}>
          LE PRESENTAMOS COTIZACIÓN DE {selSys.name.toUpperCase()}, APLICADO EN LOSA DE LA SIGUIENTE MANERA:
        </p>
        <table>
          <thead>
            <tr>
              <th>PART</th>
              <th>DESCRIPCIÓN</th>
              <th>UNIDAD</th>
              <th>CANT.</th>
              <th>P. UNI.</th>
              <th>IMPORTE</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{1}</td>
              <td>
                SUMINISTRO Y APLICACIÓN DE {selSys.name.toUpperCase()}, APLICADO EN LOSA, PRETILES Y DETALLES DE LA SIGUIENTE MANERA:
                <br />
                {selSys.proc
                  .split(' · ')
                  .map((x) => '  ' + x)
                  .join('\n')}
              </td>
              <td>M2</td>
              <td>{sel.area.dev.toFixed(2)}</td>
              <td>{fmt2(sel.unitPrice)}</td>
              <td>{fmt2(sel.main)}</td>
            </tr>
            {quote.extras
              .filter((e) => e.enabled)
              .map((e, i) => (
                <tr key={e.id}>
                  <td>{i + 2}</td>
                  <td>{e.concept.toUpperCase()}</td>
                  <td>{e.unitName.toUpperCase()}</td>
                  <td>{e.qty}</td>
                  <td>{fmt2(e.price)}</td>
                  <td>{fmt2(e.qty * e.price)}</td>
                </tr>
              ))}
            <tr>
              <td colSpan={5} style={{ textAlign: 'right' }}>
                <b>SUB-TOTAL:</b>
              </td>
              <td>{fmt2(sel.sub)}</td>
            </tr>
            {sel.iva > 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'right' }}>
                  IVA:
                </td>
                <td>{fmt2(sel.iva)}</td>
              </tr>
            )}
            <tr>
              <td colSpan={5} style={{ textAlign: 'right' }}>
                <b>TOTAL:</b>
              </td>
              <td>
                <b>{fmt2(sel.total)}</b>
              </td>
            </tr>
          </tbody>
        </table>
        <p style={{ fontSize: 12, marginTop: 14 }}>
          <b>NOTAS:</b>
          <br />
          *VIGENCIA DE COTIZACIÓN: 30 DÍAS NATURALES*
          <br />
          *GARANTÍA DE {selSys.warranty} AÑOS POR ESCRITO*{selSys.warranty < selSys.life ? ` (VIDA ÚTIL ESTIMADA ${selSys.life} AÑOS CON MANTENIMIENTO)` : ''}
          <br />
          {!quote.verified && '*QUEDA A RESERVA DE VERIFICAR ÁREA*'}
          <br />
          {quote.priceMode === 'promo' && `*COSTO DE PROMOCIÓN DE ${fmt2(selSys.list)} A ${fmt2(selSys.promo)} M2*`}
          <br />
          *AL AUTORIZAR EL PRESUPUESTO {selSys.pago.split('/')[0]}% DE ANTICIPO Y {selSys.pago.split('/')[1]}% SOBRE AVANCE DE OBRA*
          <br />
          {quote.billing !== 'si' && '*SI REQUIERE FACTURA SERÍA MÁS IVA*'}
          <br />
          ***MÁS DE 45 AÑOS DE EXPERIENCIA***
        </p>
        <p style={{ fontSize: 12, marginTop: 18 }}>
          ATENTAMENTE
          <br />
          <b>JOSÉ JAIME PEÑA GARZA</b>
          <br />
          Blvd. Diagonal de las Fuentes #4099, Col. Ejido La Merced, Torreón, Coah. · Tel. (871) 732 22 20 · WhatsApp (871) 171 37 56 · impertodotorreon@hotmail.com
        </p>
      </div>
    </>
  );
}
