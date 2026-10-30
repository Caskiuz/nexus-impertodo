'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { computeQuote, validations, type SystemDef, type QuoteInput } from '@/lib/calc';
import { fmt, fmt2 } from '@/lib/constants';
import { systemImage, elementImage } from '@/lib/images';
import { saveQuoteAction } from '@/actions/quotes';

interface ClientLite {
  id: string;
  name: string;
  sector: string;
  contact: string | null;
  phone: string | null;
  address: string | null;
  area: number | null;
}

interface ExtraState {
  concept: string;
  unitName: string;
  qty: number;
  price: number;
  costFactor: number;
  enabled: boolean;
  sourceLabel?: string;
}

const DEFAULT_EXTRAS: ExtraState[] = [
  { concept: 'Retiro de acrílico ampollado/despegado y disposición', unitName: 'm²', qty: 197, price: 28, costFactor: 0.68, enabled: false, sourceLabel: 'Diagnóstico: ampollas' },
  { concept: 'Resane de fisuras en pretil con mortero flexible + refuerzo', unitName: 'ml', qty: 38, price: 65, costFactor: 0.68, enabled: false, sourceLabel: 'Diagnóstico: fisura pretil' },
  { concept: 'Corrección de pendiente zona de encharcamiento (mortero ≈2%)', unitName: 'm²', qty: 45, price: 120, costFactor: 0.68, enabled: false, sourceLabel: 'Diagnóstico: encharcamiento' },
  { concept: 'Refuerzo de bajantes y domo con membrana líquida', unitName: 'pza', qty: 5, price: 380, costFactor: 0.6, enabled: false, sourceLabel: 'Levantamiento' }
];

const n = (v: string) => {
  const x = parseFloat(v.replace(',', '.'));
  return Number.isFinite(x) ? x : 0;
};

export default function CotizarWizard({
  systems,
  clients,
  floor,
  indirect,
  documentedKeys,
  prefill,
  hideMargins
}: {
  systems: SystemDef[];
  clients: ClientLite[];
  floor: number;
  indirect: number;
  documentedKeys: string[];
  prefill: { area?: string; sys?: string; client?: string };
  hideMargins: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [clientName, setClientName] = useState(prefill.client || '');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [sector, setSector] = useState('Gobierno / Salud');
  const [element, setElement] = useState('Losa de azotea no transitable');
  const [address, setAddress] = useState('');
  const [billing, setBilling] = useState('si');
  const [access, setAccess] = useState('1');
  const [moving, setMoving] = useState('0');
  const [planta, setPlanta] = useState(prefill.area || '1314.18');
  const [perim, setPerim] = useState('150');
  const [alt, setAlt] = useState('0.40');
  const [baj, setBaj] = useState('4');
  const [dom, setDom] = useState('1');
  const [duc, setDuc] = useState('6');
  const [verified, setVerified] = useState(false);
  const [drainageOk, setDrainageOk] = useState(true);
  const [diagnosed, setDiagnosed] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [optA, setOptA] = useState('acr10');
  const [optB, setOptB] = useState(prefill.sys && systems.some((s) => s.key === prefill.sys) ? prefill.sys : 'sbs45');
  const [selected, setSelected] = useState<'A' | 'B'>('B');
  const [priceMode, setPriceMode] = useState('promo');
  const [marginTarget, setMarginTarget] = useState('32');
  const [discount, setDiscount] = useState('0');
  const [provider, setProvider] = useState('nac');
  const [extras, setExtras] = useState<ExtraState[]>(DEFAULT_EXTRAS);
  const [showApu, setShowApu] = useState(false);
  const [saved, setSaved] = useState<{ id: string; folio: string; sent: boolean } | null>(null);
  const [msg, setMsg] = useState('');
  const [pending, startTransition] = useTransition();

  const input: QuoteInput = {
    planta: n(planta),
    perim: n(perim),
    alt: n(alt),
    baj: n(baj),
    dom: n(dom),
    duc: n(duc),
    optA,
    optB,
    selected,
    priceMode,
    marginTarget: n(marginTarget),
    discount: n(discount),
    floor,
    indirect,
    provider,
    access,
    moving: n(moving),
    billing: billing === 'si',
    extras
  };

  const sysA = systems.find((s) => s.key === optA) || systems[0];
  const sysB = systems.find((s) => s.key === optB) || systems[1];
  const selKey = selected === 'A' ? optA : optB;
  const sys = systems.find((s) => s.key === selKey) || sysA;

  const c = useMemo(() => computeQuote(sys, input), [sys, JSON.stringify(input)]);
  const cA = useMemo(() => computeQuote(sysA, input), [sysA, JSON.stringify(input)]);
  const cB = useMemo(() => computeQuote(sysB, input), [sysB, JSON.stringify(input)]);
  const checks = validations(sys, input, c, {
    verified,
    drainageOk,
    diagnosed,
    documented: documentedKeys.includes(selKey)
  });
  const badCount = checks.filter((x) => x.kind === 'bad').length;
  const warnCount = checks.filter((x) => x.kind === 'warn').length;

  function flash(m: string) {
    setMsg(m);
    window.setTimeout(() => setMsg(''), 3200);
  }

  function pickClient(id: string) {
    const cl = clients.find((x) => x.id === id);
    if (!cl) return;
    setClientName(cl.name);
    setContact(cl.contact || '');
    setPhone(cl.phone || '');
    setSector(cl.sector);
    setAddress(cl.address || '');
    if (cl.area) setPlanta(String(cl.area));
  }

  function analyze() {
    setDiagnosing(true);
    window.setTimeout(() => {
      setDiagnosing(false);
      setDiagnosed(true);
      setExtras((prev) => prev.map((e) => ({ ...e, enabled: true })));
      flash('Diagnóstico listo: 4 partidas previas activadas');
    }, 900);
  }

  function save(send: boolean) {
    startTransition(async () => {
      const res = await saveQuoteAction({
        clientName: clientName || 'Cliente sin nombre',
        contact,
        phone,
        sector,
        element,
        address,
        billing: billing as 'si' | 'no',
        access,
        moving: n(moving),
        planta: n(planta),
        perim: n(perim),
        alt: n(alt),
        baj: n(baj),
        dom: n(dom),
        duc: n(duc),
        verified,
        drainageOk,
        diagnosed,
        optA,
        optB,
        selected,
        priceMode,
        marginTarget: n(marginTarget),
        discount: n(discount),
        provider,
        extras,
        send
      });
      if (res.ok && res.id && res.folio) {
        setSaved({ id: res.id, folio: res.folio, sent: send });
        flash(send ? `Cotización ${res.folio} enviada (demo) · seguimiento programado` : `Borrador ${res.folio} guardado`);
        router.refresh();
      } else {
        flash(res.error || 'No se pudo guardar');
      }
    });
  }

  const steps = ['Cliente', 'Medición', 'Diagnóstico', 'Opciones', 'Precio y envío'];

  return (
    <>
      <div className="steps">
        {steps.map((s, i) => (
          <button
            key={s}
            className={`step ${step === i + 1 ? 'on' : ''} ${step > i + 1 ? 'done' : ''}`}
            onClick={() => setStep(i + 1)}
          >
            <span className="n">{step > i + 1 ? '✓' : i + 1}</span>
            {s}
          </button>
        ))}
      </div>

      <div className="wizard">
        <div className="card wiz-body">
          <div className={`panel-step ${step === 1 ? 'on' : ''}`}>
            <h2>Cliente y obra</h2>
            <div className="hint">Selecciona una cuenta existente o captura el prospecto. La ficha del cliente se reutiliza en toda la obra.</div>
            <div className="field">
              <label>Cliente existente</label>
              <select defaultValue="" onChange={(e) => pickClient(e.target.value)}>
                <option value="">— Capturar nuevo —</option>
                {clients.map((cl) => (
                  <option key={cl.id} value={cl.id}>
                    {cl.name} · {cl.sector}
                  </option>
                ))}
              </select>
            </div>
            <div className="row2">
              <div className="field">
                <label>Cliente / empresa</label>
                <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Ej. Unidad de Consulta Externa Torreón" />
              </div>
              <div className="field">
                <label>Contacto</label>
                <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Ing. Isaac Díaz" />
              </div>
              <div className="field">
                <label>WhatsApp</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="871 000 0000" />
              </div>
              <div className="field">
                <label>Sector</label>
                <select value={sector} onChange={(e) => setSector(e.target.value)}>
                  <option>Gobierno / Salud</option>
                  <option>Industrial</option>
                  <option>Comercial</option>
                  <option>Residencial</option>
                  <option>Minero</option>
                </select>
              </div>
              <div className="field">
                <label>Elemento</label>
                <select value={element} onChange={(e) => setElement(e.target.value)}>
                  <option>Losa de azotea no transitable</option>
                  <option>Losa transitable</option>
                  <option>Nave / lámina</option>
                  <option>Cisterna</option>
                  <option>Muro / cimentación</option>
                  <option>Piso industrial</option>
                </select>
              </div>
              <div className="field">
                <label>Factura</label>
                <select value={billing} onChange={(e) => setBilling(e.target.value)}>
                  <option value="si">CFDI 4.0 + IVA</option>
                  <option value="no">No requiere (precio neto)</option>
                </select>
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Obra / dirección</label>
                <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Calle, colonia, ciudad" />
              </div>
              <div className="field">
                <label>Acceso / altura</label>
                <select value={access} onChange={(e) => setAccess(e.target.value)}>
                  <option value="1">Normal</option>
                  <option value="1.15">Complejo (+15% destajo)</option>
                  <option value="1.3">Altura / maniobras (+30%)</option>
                </select>
              </div>
              <div className="field">
                <label>Movilización / viáticos ($)</label>
                <input type="number" value={moving} onChange={(e) => setMoving(e.target.value)} />
              </div>
            </div>
          </div>

          <div className={`panel-step ${step === 2 ? 'on' : ''}`}>
            <h2>Medición y área desarrollada</h2>
            <div className="hint">El área desarrollada suma pretiles, chaflanes, bajantes, domos y ductos: hasta 15% que se dejan de cobrar.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <img
                className="img-thumb"
                style={{ width: 104, height: 64, objectFit: 'cover' }}
                src={elementImage(element)}
                alt={element}
              />
              <div>
                <b>{element}</b>
                <div className="mini">Servicio seleccionado · el diagnóstico ajusta las partidas previas.</div>
              </div>
            </div>
            <div className="row3">
              <div className="field">
                <label>Área en planta (m²)</label>
                <input type="number" value={planta} onChange={(e) => setPlanta(e.target.value)} />
              </div>
              <div className="field">
                <label>Perímetro pretil (m)</label>
                <input type="number" value={perim} onChange={(e) => setPerim(e.target.value)} />
              </div>
              <div className="field">
                <label>Altura pretil (m)</label>
                <input type="number" step="0.05" value={alt} onChange={(e) => setAlt(e.target.value)} />
              </div>
              <div className="field">
                <label>Bajantes</label>
                <input type="number" value={baj} onChange={(e) => setBaj(e.target.value)} />
              </div>
              <div className="field">
                <label>Domos / registros</label>
                <input type="number" value={dom} onChange={(e) => setDom(e.target.value)} />
              </div>
              <div className="field">
                <label>Perímetro ductos (m)</label>
                <input type="number" value={duc} onChange={(e) => setDuc(e.target.value)} />
              </div>
              <div className="field">
                <label>¿Área verificada en sitio?</label>
                <select value={verified ? 'si' : 'no'} onChange={(e) => setVerified(e.target.value === 'si')}>
                  <option value="no">No, pre-cotización</option>
                  <option value="si">Sí, medida física</option>
                </select>
              </div>
              <div className="field">
                <label>Pendiente / drenaje</label>
                <select value={drainageOk ? 'ok' : 'charcos'} onChange={(e) => setDrainageOk(e.target.value === 'ok')}>
                  <option value="charcos">Encharca (corregir)</option>
                  <option value="ok">Drena bien (≥2%)</option>
                </select>
              </div>
            </div>
            <div className="area-box">
              <div className="big">{c.area.dev.toFixed(1)} m²</div>
              <span>
                planta {c.area.planta.toFixed(1)} + pretiles {c.area.pretil.toFixed(1)} + chaflanes {c.area.chaflan.toFixed(1)} + bajantes/domos{' '}
                {(c.area.bajantes + c.area.domos).toFixed(1)} + ductos {c.area.ductos.toFixed(1)}
              </span>
            </div>
            <div className="alert b" style={{ marginTop: 11 }}>
              Pre-cotiza sin visita; la propuesta lleva <b>&quot;a reserva de verificar área&quot;</b> hasta confirmar en sitio.
            </div>
          </div>

          <div className={`panel-step ${step === 3 ? 'on' : ''}`}>
            <h2>Diagnóstico de daños por IA</h2>
            <div className="hint">El diagnóstico define partidas previas y sistema recomendado. Nunca bloquea: puedes seguir sin él.</div>
            <button className="btn azul" onClick={analyze} disabled={diagnosing}>
              {diagnosing ? 'Analizando…' : '🔬 Analizar fotos con IA'}
            </button>
            <div style={{ marginTop: 11 }}>
              {!diagnosed && !diagnosing && (
                <div className="alert" style={{ color: 'var(--gris)' }}>
                  Pulsa &quot;Analizar&quot;. El diagnóstico llega solo y propone partidas previas.
                </div>
              )}
              {diagnosing && <div className="alert b">Analizando fotos contra el árbol de fallas…</div>}
              {diagnosed && (
                <>
                  <div className="alert r"><b>Crítico</b> · Encharcamiento NE → partida corrección de pendiente</div>
                  <div className="alert r"><b>Crítico</b> · Ampollas 15% → partida retiro</div>
                  <div className="alert y"><b>Alto</b> · Fisuras pretil sur → partida resane</div>
                  <div className="alert y"><b>Alto</b> · Bajante 2 sin refuerzo → partida refuerzo</div>
                  <div className="alert g">
                    <b>Recomendación:</b> Rollo SBS 4.5 mm (encharcamiento + tránsito). Alternativa: acrílico solo con pendiente corregida al 100%.
                  </div>
                </>
              )}
            </div>
          </div>

          <div className={`panel-step ${step === 4 ? 'on' : ''}`}>
            <h2>Dos opciones: lo que pidió y lo que necesita</h2>
            <div className="hint">Ambas con costo por m² por año para vencer la objeción de precio.</div>
            <div className="row2">
              {[
                { letter: 'A' as const, key: optA, set: setOptA, comp: cA, sysDef: sysA },
                { letter: 'B' as const, key: optB, set: setOptB, comp: cB, sysDef: sysB }
              ].map(({ letter, key, set, comp, sysDef }) => (
                <div key={letter} className={`opt ${selected === letter ? 'sel' : ''}`} onClick={() => setSelected(letter)}>
                  <img className="opt-img" src={systemImage(sysDef.key)} alt={sysDef.name} />
                  <span className="reco" style={letter === 'B' ? undefined : { background: 'var(--gris)' }}>
                    {letter === 'B' ? 'Recomendada' : 'Lo que pidió'}
                  </span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <h3>{sysDef.short}</h3>
                    <select
                      value={key}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => set(e.target.value)}
                      style={{ maxWidth: 150 }}
                    >
                      {systems.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.short}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="price">
                    <s style={{ color: 'var(--gris)', fontSize: 15 }}>{fmt(sysDef.list)}</s> {fmt(comp.unitPrice)} <small>/m² {comp.iva > 0 ? '+ IVA' : 'neto'}</small>
                  </div>
                  <dl>
                    <dt>Total {comp.area.dev.toFixed(0)} m² + partidas</dt>
                    <dd>{fmt(comp.total)}</dd>
                    <dt>Vida útil · garantía</dt>
                    <dd>
                      {sysDef.life} a · {sysDef.warranty} a
                    </dd>
                    <dt>
                      <b>$/m²/año</b>
                    </dt>
                    <dd>
                      <b>{fmt(comp.perYearValue)}</b>
                    </dd>
                    <dt>Material</dt>
                    <dd>
                      {comp.packs} {comp.packUnit}
                    </dd>
                    <dt>Pago</dt>
                    <dd>{sysDef.pago}</dd>
                  </dl>
                  {!hideMargins && (
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`semaforo ${comp.semaforo}`} style={{ fontSize: 14 }}>
                        {(comp.margin * 100).toFixed(0)}%
                      </span>
                      <span style={{ fontSize: 10.5, color: 'var(--gris)' }}>margen bruto · piso {floor}%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="card panel" style={{ marginTop: 4 }}>
              <div className="sec">Partidas previas (del diagnóstico y levantamiento)</div>
              <div className="tbl">
                <table>
                  <thead>
                    <tr>
                      <th></th>
                      <th>Concepto</th>
                      <th>Unidad</th>
                      <th className="num">Cant.</th>
                      <th className="num">P.U.</th>
                      <th className="num">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extras.map((e, i) => (
                      <tr key={i}>
                        <td>
                          <input
                            type="checkbox"
                            checked={e.enabled}
                            onChange={(ev) => setExtras((prev) => prev.map((x, j) => (j === i ? { ...x, enabled: ev.target.checked } : x)))}
                          />
                        </td>
                        <td>
                          {e.concept}
                          <br />
                          <span className="mini">{e.sourceLabel}</span>
                        </td>
                        <td>{e.unitName}</td>
                        <td className="num">
                          <input
                            type="number"
                            value={e.qty}
                            style={{ width: 74, textAlign: 'right' }}
                            onChange={(ev) => setExtras((prev) => prev.map((x, j) => (j === i ? { ...x, qty: n(ev.target.value) } : x)))}
                          />
                        </td>
                        <td className="num">
                          <input
                            type="number"
                            value={e.price}
                            style={{ width: 80, textAlign: 'right' }}
                            onChange={(ev) => setExtras((prev) => prev.map((x, j) => (j === i ? { ...x, price: n(ev.target.value) } : x)))}
                          />
                        </td>
                        <td className="num">{fmt(e.qty * e.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className={`panel-step ${step === 5 ? 'on' : ''}`}>
            <h2>Precio, margen y validación</h2>
            <div className="row3">
              <div className="field">
                <label>Modo de precio</label>
                <select value={priceMode} onChange={(e) => setPriceMode(e.target.value)}>
                  <option value="promo">Promoción</option>
                  <option value="lista">Lista</option>
                  <option value="manual">Manual</option>
                  <option value="margen">Desde margen objetivo</option>
                </select>
              </div>
              <div className="field">
                <label>Margen objetivo (%)</label>
                <input type="number" value={marginTarget} onChange={(e) => setMarginTarget(e.target.value)} />
              </div>
              <div className="field">
                <label>Descuento (%)</label>
                <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </div>
              <div className="field">
                <label>Proveedor de material</label>
                <select value={provider} onChange={(e) => setProvider(e.target.value)}>
                  <option value="nac">Marca nacional</option>
                  <option value="psm">PROSEALMASTER (−30% landed)</option>
                </select>
              </div>
            </div>
            <label className="switch" style={{ marginBottom: 12 }}>
              <input type="checkbox" checked={showApu} onChange={(e) => setShowApu(e.target.checked)} /> Ver APU y costos detallados (administración)
            </label>
            {showApu && (
              <div className="tbl">
                <table>
                  <thead>
                    <tr>
                      <th>Part.</th>
                      <th>Descripción</th>
                      <th>Unidad</th>
                      <th className="num">Cant.</th>
                      <th className="num">P.U.</th>
                      <th className="num">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>1</td>
                      <td>Suministro y aplicación de {sys.name}, aplicado en losa, pretiles y detalles</td>
                      <td>m²</td>
                      <td className="num">{c.area.dev.toFixed(2)}</td>
                      <td className="num">{fmt2(c.unitPrice)}</td>
                      <td className="num">{fmt2(c.main)}</td>
                    </tr>
                    {extras.filter((e) => e.enabled).map((e, i) => (
                      <tr key={i}>
                        <td>{i + 2}</td>
                        <td>{e.concept}</td>
                        <td>{e.unitName}</td>
                        <td className="num">{e.qty}</td>
                        <td className="num">{fmt2(e.price)}</td>
                        <td className="num">{fmt2(e.qty * e.price)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={5} className="num">
                        <b>Sub-total</b>
                      </td>
                      <td className="num">
                        <b>{fmt2(c.sub)}</b>
                      </td>
                    </tr>
                    {c.iva > 0 && (
                      <tr>
                        <td colSpan={5} className="num">
                          IVA 16%
                        </td>
                        <td className="num">{fmt2(c.iva)}</td>
                      </tr>
                    )}
                    <tr>
                      <td colSpan={5} className="num">
                        <b>TOTAL</b>
                      </td>
                      <td className="num">
                        <b>{fmt2(c.total)}</b>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            <div className="sec" style={{ margin: '13px 0 5px' }}>
              Validador anti-error
            </div>
            {checks.map((chk, i) => (
              <div className="rule" key={i}>
                <span className={`ic ${chk.kind}`}>{chk.kind === 'ok' ? '✓' : '!'}</span>
                <div>{chk.text}</div>
              </div>
            ))}
            <div className="alert" style={{ marginTop: 10 }}>
              <b>Procedimiento para la propuesta:</b> {sys.proc}
            </div>
          </div>

          <div className="wiz-foot">
            <button className="btn" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>
              ← Atrás
            </button>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {step < 5 && (
                <button className="btn primary" onClick={() => setStep((s) => Math.min(5, s + 1))}>
                  Siguiente →
                </button>
              )}
              {step === 5 && (
                <>
                  <button className="btn" onClick={() => save(false)} disabled={pending}>
                    {pending ? 'Guardando…' : 'Guardar borrador'}
                  </button>
                  <button className="btn primary" onClick={() => save(true)} disabled={pending}>
                    {pending ? 'Guardando…' : 'Guardar y enviar →'}
                  </button>
                  {saved && (
                    <>
                      <Link className="btn wa" href={`/propuesta?folio=${saved.folio}`}>
                        📱 Propuesta viva
                      </Link>
                      <a className="btn" href={`/p/${saved.folio}`} target="_blank">
                        Ver enlace público
                      </a>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="summary">
          <div className="card panel">
            <div className="sec">Resumen en vivo</div>
            <div className="sumline">
              <span>Cliente</span>
              <b>{clientName || '—'}</b>
            </div>
            <div className="sumline">
              <span>Sistema</span>
              <b>{sys.short}</b>
            </div>
            <div className="sumline">
              <span>Área facturable</span>
              <b>{c.area.dev.toFixed(1)} m²</b>
            </div>
            <div className="sumline">
              <span>Precio final /m²</span>
              <b>{fmt(c.unitPrice)}</b>
            </div>
            <div className="sumline">
              <span>Partidas previas</span>
              <b>{fmt(c.extrasSum)}</b>
            </div>
            <div className="sumline">
              <span>Subtotal</span>
              <b>{fmt(c.sub)}</b>
            </div>
            <div className="sumline">
              <span>IVA 16%</span>
              <b>{fmt(c.iva)}</b>
            </div>
            <div className="sumline total">
              <span>TOTAL</span>
              <b>{fmt(c.total)}</b>
            </div>
            {!hideMargins && (
              <div style={{ marginTop: 9 }}>
                <span className={`semaforo ${c.semaforo}`}>{(c.margin * 100).toFixed(0)}%</span>{' '}
                <span className="mini">margen · piso {floor}%</span>
                {c.semaforo === 'bad' ? (
                  <span className="badge bad">Requiere autorización de gerencia</span>
                ) : c.semaforo === 'warn' ? (
                  <span className="badge warn">Cerca del piso</span>
                ) : (
                  <span className="badge ok">Lista para enviar</span>
                )}
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              {badCount ? (
                <span className="badge bad">
                  {badCount} bloqueo · {warnCount} avisos
                </span>
              ) : warnCount ? (
                <span className="badge warn">{warnCount} avisos</span>
              ) : (
                <span className="badge ok">Validación completa</span>
              )}
            </div>
            {saved && (
              <div className="alert g" style={{ marginTop: 10 }}>
                <b>{saved.folio}</b> {saved.sent ? 'enviada' : 'guardada como borrador'}.
              </div>
            )}
          </div>
          <div className="card panel" style={{ marginTop: 13 }}>
            <div className="sec">Costo interno</div>
            <div className="sumline">
              <span>Material ({c.packs} {c.packUnit})</span>
              <b>{fmt(c.cb.mat)}</b>
            </div>
            <div className="sumline">
              <span>Destajo × acceso</span>
              <b>{fmt(c.cb.labor)}</b>
            </div>
            <div className="sumline">
              <span>Consumibles + movilización</span>
              <b>{fmt(c.cb.cons + c.cb.mov)}</b>
            </div>
            <div className="sumline">
              <span>Indirectos</span>
              <b>{fmt(c.cb.ind)}</b>
            </div>
            <div className="sumline">
              <span>Costo partidas previas</span>
              <b>{fmt(c.extrasCost)}</b>
            </div>
            <div className="sumline total">
              <span>Utilidad bruta</span>
              <b>{fmt(c.sub - c.cost)}</b>
            </div>
          </div>
        </div>
      </div>
      <div className={`toast ${msg ? 'show' : ''}`}>{msg}</div>
    </>
  );
}
