'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { computeQuote, validations, type SystemDef, type QuoteInput } from '@/lib/calc';
import { fmt, fmt2 } from '@/lib/constants';
import { systemImage, elementImage, systemSvg, elementSvg } from '@/lib/images';
import SmartImage from '@/components/SmartImage';
import PhotoCredit from '@/components/PhotoCredit';
import { compressImageFile } from '@/lib/compress-image';
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

export interface QuoteEditData {
  id: string;
  folio: string;
  clientName: string;
  contact: string;
  phone: string;
  sector: string;
  element: string;
  address: string;
  billing: 'si' | 'no';
  access: string;
  moving: number;
  planta: number;
  perim: number;
  alt: number;
  baj: number;
  dom: number;
  duc: number;
  chaflan: number;
  extraSections: { p: number; h: number }[];
  floors: number;
  buildingHeight: number;
  difficultyNote: string;
  verified: boolean;
  drainageOk: boolean;
  diagnosed: boolean;
  optA: string;
  optB: string;
  selected: 'A' | 'B';
  priceMode: string;
  marginTarget: number;
  discount: number;
  provider: string;
  extras: ExtraState[];
  photos: { id: string; dataUrl: string }[];
}

const DRAFT_KEY = 'impertodo.cotizar.draft';
const MAX_PHOTOS = 8;

interface DiagnosisFinding {
  severity: string;
  title: string;
  detail: string;
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
  hideMargins,
  quoteData
}: {
  systems: SystemDef[];
  clients: ClientLite[];
  floor: number;
  indirect: number;
  documentedKeys: string[];
  prefill: { area?: string; sys?: string; client?: string };
  hideMargins: boolean;
  quoteData?: QuoteEditData | null;
}) {
  const router = useRouter();
  const q = quoteData ?? null;
  const [step, setStep] = useState(1);
  const [clientName, setClientName] = useState(q?.clientName || prefill.client || '');
  const [contact, setContact] = useState(q?.contact || '');
  const [phone, setPhone] = useState(q?.phone || '');
  const [sector, setSector] = useState(q?.sector || 'Gobierno / Salud');
  const [element, setElement] = useState(q?.element || 'Losa de azotea no transitable');
  const [address, setAddress] = useState(q?.address || '');
  const [billing, setBilling] = useState<string>(q?.billing || 'si');
  const [access, setAccess] = useState(q?.access || '1');
  const [moving, setMoving] = useState(q ? String(q.moving) : '0');
  const [planta, setPlanta] = useState(q ? String(q.planta) : prefill.area || '1314.18');
  const [perim, setPerim] = useState(q ? String(q.perim) : '150');
  const [alt, setAlt] = useState(q ? String(q.alt) : '0.40');
  const [baj, setBaj] = useState(q ? String(q.baj) : '4');
  const [dom, setDom] = useState(q ? String(q.dom) : '1');
  const [duc, setDuc] = useState(q ? String(q.duc) : '6');
  const [chaflan, setChaflan] = useState(q ? String(q.chaflan) : '0');
  const [sections, setSections] = useState<{ p: string; h: string }[]>(
    q ? q.extraSections.map((s) => ({ p: String(s.p), h: String(s.h) })) : []
  );
  const [floors, setFloors] = useState(q ? String(q.floors) : '1');
  const [buildingHeight, setBuildingHeight] = useState(q ? String(q.buildingHeight) : '0');
  const [difficultyNote, setDifficultyNote] = useState(q?.difficultyNote || '');
  const [verified, setVerified] = useState(q?.verified ?? false);
  const [drainageOk, setDrainageOk] = useState(q?.drainageOk ?? true);
  const [diagnosed, setDiagnosed] = useState(q?.diagnosed ?? false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [optA, setOptA] = useState(q?.optA || 'acr10');
  const [optB, setOptB] = useState(q?.optB || (prefill.sys && systems.some((s) => s.key === prefill.sys) ? prefill.sys : 'sbs45'));
  const [selected, setSelected] = useState<'A' | 'B'>(q?.selected || 'B');
  const [priceMode, setPriceMode] = useState(q?.priceMode || 'promo');
  const [marginTarget, setMarginTarget] = useState(q ? String(q.marginTarget) : '32');
  const [discount, setDiscount] = useState(q ? String(q.discount) : '0');
  const [provider, setProvider] = useState(q?.provider || 'nac');
  const [extras, setExtras] = useState<ExtraState[]>(
    q?.extras || DEFAULT_EXTRAS
  );
  const [photos, setPhotos] = useState<{ id?: string; dataUrl: string }[]>(q?.photos || []);
  const [findings, setFindings] = useState<DiagnosisFinding[]>([]);
  const [recommendation, setRecommendation] = useState('');
  const [analysisMode, setAnalysisMode] = useState<'gemini' | 'fallback' | null>(null);
  const [showApu, setShowApu] = useState(false);
  const [saved, setSaved] = useState<{ id: string; folio: string; sent: boolean } | null>(null);
  const [msg, setMsg] = useState('');
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftCleared, setDraftCleared] = useState(false);
  const [pending, startTransition] = useTransition();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const input: QuoteInput = {
    planta: n(planta),
    perim: n(perim),
    alt: n(alt),
    baj: n(baj),
    dom: n(dom),
    duc: n(duc),
    chaflan: n(chaflan),
    extraSections: sections.map((s) => ({ p: n(s.p), h: n(s.h) })),
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

  function addSection() {
    setSections((prev) => [...prev, { p: '', h: '' }]);
  }

  function removeSection(i: number) {
    setSections((prev) => prev.filter((_, j) => j !== i));
  }

  function updateSection(i: number, field: 'p' | 'h', value: string) {
    setSections((prev) => prev.map((s, j) => (j === i ? { ...s, [field]: value } : s)));
  }

  // ---------- Borrador local (autosave) ----------
  const draftJson = useMemo(
    () =>
      JSON.stringify({
        step,
        clientName,
        contact,
        phone,
        sector,
        element,
        address,
        billing,
        access,
        moving,
        planta,
        perim,
        alt,
        baj,
        dom,
        duc,
        chaflan,
        sections,
        floors,
        buildingHeight,
        difficultyNote,
        verified,
        drainageOk,
        optA,
        optB,
        selected,
        priceMode,
        marginTarget,
        discount,
        provider,
        extras,
        photoIds: photos.map((p) => p.id).filter((x): x is string => Boolean(x))
      }),
    [step, clientName, contact, phone, sector, element, address, billing, access, moving, planta, perim, alt, baj, dom, duc, chaflan, sections, floors, buildingHeight, difficultyNote, verified, drainageOk, optA, optB, selected, priceMode, marginTarget, discount, provider, extras, photos]
  );

  useEffect(() => {
    if (q) return; // editando una cotización guardada: sus datos son la fuente de verdad
    (async () => {
      try {
        const raw = window.localStorage.getItem(DRAFT_KEY);
        if (raw) {
          const d = JSON.parse(raw) as Record<string, unknown>;
          if (d && typeof d === 'object') {
          const set = <T,>(setter: (v: T) => void, v: unknown, fallback: T) => setter((v ?? fallback) as T);
          set(setStep, d.step, 1);
          set(setClientName, d.clientName, '');
          set(setContact, d.contact, '');
          set(setPhone, d.phone, '');
          set(setSector, d.sector, 'Gobierno / Salud');
          set(setElement, d.element, 'Losa de azotea no transitable');
          set(setAddress, d.address, '');
          set(setBilling, d.billing, 'si');
          set(setAccess, d.access, '1');
          set(setMoving, d.moving, '0');
          set(setPlanta, d.planta, '1314.18');
          set(setPerim, d.perim, '150');
          set(setAlt, d.alt, '0.40');
          set(setBaj, d.baj, '4');
          set(setDom, d.dom, '1');
          set(setDuc, d.duc, '6');
          set(setChaflan, d.chaflan, '0');
          if (Array.isArray(d.sections)) setSections(d.sections as { p: string; h: string }[]);
          set(setFloors, d.floors, '1');
          set(setBuildingHeight, d.buildingHeight, '0');
          set(setDifficultyNote, d.difficultyNote, '');
          set(setVerified, d.verified, false);
          set(setDrainageOk, d.drainageOk, true);
          set(setOptA, d.optA, 'acr10');
          set(setOptB, d.optB, 'sbs45');
          set(setSelected, d.selected, 'B');
          set(setPriceMode, d.priceMode, 'promo');
          set(setMarginTarget, d.marginTarget, '32');
          set(setDiscount, d.discount, '0');
          set(setProvider, d.provider, 'nac');
          if (Array.isArray(d.extras)) setExtras(d.extras as ExtraState[]);
          setDraftRestored(true);
          // Las fotos se suben al servidor al adjuntarse: el borrador guarda sus ids y aquí se recuperan.
          const photoIds = Array.isArray(d.photoIds) ? (d.photoIds as string[]).filter(Boolean) : [];
          if (photoIds.length) {
            try {
              const r = await fetch(`/api/quote-photos?ids=${encodeURIComponent(photoIds.join(','))}`);
              const data = await r.json();
              if (r.ok && data.ok && Array.isArray(data.photos)) {
                setPhotos(data.photos as { id: string; dataUrl: string }[]);
              }
            } catch {
              /* sin conexión a las fotos: se continúa sin ellas */
            }
          }
        }
      }
        } catch {
          /* borrador corrupto: se ignora */
        }
      })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (q || draftCleared) return;
    const t = window.setTimeout(() => {
      try {
        window.localStorage.setItem(DRAFT_KEY, draftJson);
      } catch {
        /* sin espacio o modo privado: se ignora */
      }
    }, 500);
    return () => window.clearTimeout(t);
  }, [draftJson, q, draftCleared]);

  function discardDraft() {
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setDraftCleared(true);
    setDraftRestored(false);
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

  // ---------- Fotos del área (diagnóstico) ----------
  async function attachFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      flash(`Máximo ${MAX_PHOTOS} fotos por cotización.`);
      return;
    }
    setUploadingPhoto(true);
    const files = Array.from(fileList).slice(0, room);
    for (const file of files) {
      try {
        const dataUrl = await compressImageFile(file);
        const res = await fetch('/api/quote-photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: dataUrl })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'No pudo subirse la foto.');
        setPhotos((prev) => [...prev, { id: data.id, dataUrl }]);
      } catch (e) {
        flash((e as Error).message || 'No pude subir la foto.');
      }
    }
    setUploadingPhoto(false);
  }

  async function removePhoto(i: number) {
    const photo = photos[i];
    if (!photo) return;
    if (photo.id) {
      try {
        await fetch(`/api/quote-photos?id=${photo.id}`, { method: 'DELETE' });
      } catch {
        /* si falla el borrado en servidor, igual la quitamos de la vista */
      }
    }
    setPhotos((prev) => prev.filter((_, j) => j !== i));
  }

  // Activa las partidas previas relacionadas con los daños que la IA detectó en las fotos.
  function partidaMatches(text: string, concept: string): boolean {
    const c = concept.toLowerCase();
    return (
      (/(encharc|pendiente|charco)/.test(text) && /(pendiente|encharc)/.test(c)) ||
      (/(ampoll|despeg)/.test(text) && /(ampoll|retiro)/.test(c)) ||
      (/(fisur|grieta|pretil)/.test(text) && /(fisur|resane)/.test(c)) ||
      (/(bajante|domo)/.test(text) && /(bajante|refuerzo)/.test(c))
    );
  }

  function enableExtrasForFindings(list: DiagnosisFinding[]) {
    const text = list.map((f) => `${f.title} ${f.detail}`).join(' ').toLowerCase();
    const matched = extras.filter((e) => partidaMatches(text, e.concept)).length;
    setExtras((prev) => prev.map((e) => (partidaMatches(text, e.concept) ? { ...e, enabled: true } : e)));
    return matched;
  }

  async function analyze() {
    if (diagnosing) return;
    if (!photos.length) {
      flash('Primero adjunta al menos una foto del área.');
      return;
    }
    setDiagnosing(true);
    try {
      const res = await fetch('/api/quote-diagnosis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoIds: photos.map((p) => p.id).filter((x): x is string => Boolean(x)), element, planta: n(planta) })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo analizar.');
      setAnalysisMode(data.mode);
      const list: DiagnosisFinding[] = data.findings || [];
      setFindings(list);
      setRecommendation(data.recommendation || '');
      if (data.mode === 'gemini') {
        const matched = enableExtrasForFindings(list);
        setDiagnosed(true);
        flash(
          list.length
            ? `Diagnóstico listo: ${list.length} daño(s) detectado(s) · ${matched} partida(s) propuesta(s)`
            : 'Diagnóstico listo: la IA no ve daños evidentes en las fotos'
        );
      } else {
        flash('La IA no está disponible ahora: puedes continuar sin diagnóstico.');
      }
    } catch (e) {
      flash((e as Error).message || 'No se pudo analizar las fotos.');
    } finally {
      setDiagnosing(false);
    }
  }

  function save(send: boolean) {
    startTransition(async () => {
      const res = await saveQuoteAction({
        id: q?.id,
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
        chaflan: n(chaflan),
        extraSections: sections.map((s) => ({ p: n(s.p), h: n(s.h) })),
        floors: Math.max(1, Math.round(n(floors) || 1)),
        buildingHeight: n(buildingHeight),
        difficultyNote,
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
        photoIds: photos.map((p) => p.id).filter((x): x is string => Boolean(x)),
        send
      });
      if (res.ok && res.id && res.folio) {
        setSaved({ id: res.id, folio: res.folio, sent: send });
        if (!q && !draftCleared) discardDraft();
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
      {q && (
        <div className="alert b" style={{ marginBottom: 12 }}>
          Editando la cotización <b>{q.folio}</b>. Al guardar se actualiza la misma cotización (mismo folio), no se crea una nueva.{' '}
          <Link href="/cotizar">Cancelar y empezar una nueva</Link>
        </div>
      )}
      {!q && draftRestored && (
        <div className="alert g" style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <span>
            <b>Borrador recuperado</b> · tus datos quedaron guardados automáticamente en este dispositivo y no se perdieron.
          </span>
          <button className="btn sm" type="button" onClick={discardDraft}>
            Empezar en blanco
          </button>
        </div>
      )}
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
            <div className="hint">
              El área desarrollada suma planta, pretiles (con secciones extra), chaflanes, bajantes, domos y ductos. Los chaflanes ya no se
              calculan solos: escríbelos tú con tu medición real.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <SmartImage
                className="img-thumb"
                style={{ width: 104, height: 64, objectFit: 'cover' }}
                src={elementImage(element, 480)}
                fallback={elementSvg(element)}
                alt={element}
              />
              <div style={{ flex: 1 }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Tipo de área (clasificación)</label>
                  <select value={element} onChange={(e) => setElement(e.target.value)}>
                    <option>Losa de azotea no transitable</option>
                    <option>Losa transitable</option>
                    <option>Nave / lámina</option>
                    <option>Cisterna</option>
                    <option>Muro / cimentación</option>
                    <option>Piso industrial</option>
                  </select>
                </div>
                <div className="mini" style={{ marginTop: 4 }}>
                  <PhotoCredit kind="element" id={element} />
                </div>
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
                <label>Chaflanes (m²) — escríbelo tú</label>
                <input type="number" step="0.1" value={chaflan} onChange={(e) => setChaflan(e.target.value)} placeholder="0" />
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
                <label>Número de pisos del área</label>
                <input type="number" min="1" value={floors} onChange={(e) => setFloors(e.target.value)} />
              </div>
              <div className="field">
                <label>Altura de edificio / trabajo (m)</label>
                <input type="number" step="0.5" value={buildingHeight} onChange={(e) => setBuildingHeight(e.target.value)} />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Dificultad / notas de acceso</label>
                <input
                  value={difficultyNote}
                  onChange={(e) => setDifficultyNote(e.target.value)}
                  placeholder="Ej. sin elevador, azotea frágil, maniobras con viento, techo a 12 m"
                />
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

            <div className="sec" style={{ margin: '12px 0 6px' }}>
              Secciones extra de perímetro y altura
            </div>
            {sections.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                <input
                  type="number"
                  placeholder={`Perímetro sección ${i + 1} (m)`}
                  value={s.p}
                  onChange={(e) => updateSection(i, 'p', e.target.value)}
                  style={{ flex: 1 }}
                />
                <input
                  type="number"
                  step="0.05"
                  placeholder={`Altura sección ${i + 1} (m)`}
                  value={s.h}
                  onChange={(e) => updateSection(i, 'h', e.target.value)}
                  style={{ flex: 1 }}
                />
                <button className="btn sm" type="button" onClick={() => removeSection(i)} title="Quitar sección">
                  ✕
                </button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn sm" type="button" onClick={addSection}>
                + Agregar sección perímetro/altura
              </button>
              <span className="mini">
                Cada sección suma perímetro × altura al pretil. Útil cuando el edificio tiene tramos con alturas distintas.
              </span>
            </div>

            <div className="area-box" style={{ marginTop: 11 }}>
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
            <div className="hint">
              Adjunta fotos del área (desde la PC o la cámara del celular) y pulsa Analizar: la IA revisa el daño y propone las partidas
              previas. Nunca bloquea: puedes seguir sin diagnóstico.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
              <button className="btn" type="button" onClick={() => galleryRef.current?.click()} disabled={uploadingPhoto || photos.length >= MAX_PHOTOS}>
                📁 Adjuntar fotos del área
              </button>
              <button className="btn" type="button" onClick={() => cameraRef.current?.click()} disabled={uploadingPhoto || photos.length >= MAX_PHOTOS}>
                📸 Tomar foto (celular)
              </button>
              <span className="mini">
                {photos.length}/{MAX_PHOTOS} fotos · se comprimen solas al subirse
              </span>
            </div>
            <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={(e) => attachFiles(e.target.files)} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => attachFiles(e.target.files)} />
            {photos.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                {photos.map((p, i) => (
                  <div key={p.id || `nueva-${i}`} style={{ position: 'relative' }}>
                    <img
                      src={p.dataUrl}
                      alt={`Foto del área ${i + 1}`}
                      style={{ width: 120, height: 84, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--linea)', display: 'block' }}
                    />
                    <button
                      className="btn sm"
                      type="button"
                      onClick={() => removePhoto(i)}
                      title="Quitar foto"
                      style={{ position: 'absolute', top: -8, right: -8, padding: '2px 7px', borderRadius: 99 }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            {uploadingPhoto && <div className="alert b">Subiendo y comprimiendo fotos…</div>}
            <button className="btn azul" onClick={analyze} disabled={diagnosing || uploadingPhoto}>
              {diagnosing ? 'Analizando fotos…' : '🔬 Analizar fotos con IA'}
            </button>
            <div style={{ marginTop: 11 }}>
              {!photos.length && !diagnosing && (
                <div className="alert" style={{ color: 'var(--gris)' }}>
                  Adjunta fotos del techo o área (daño, charcos, óxido, bajantes). Con ellas la IA detecta los daños y propone partidas.
                </div>
              )}
              {diagnosing && <div className="alert b">Analizando fotos contra el árbol de fallas…</div>}
              {analysisMode === 'fallback' && !diagnosing && (
                <div className="alert y">{recommendation || 'La IA no está disponible ahora: puedes continuar sin diagnóstico.'}</div>
              )}
              {analysisMode === 'gemini' && findings.length === 0 && !diagnosing && (
                <div className="alert g">La IA no detectó daños evidentes en las fotos. Revisa en sitio antes de enviar.</div>
              )}
              {analysisMode === 'gemini' &&
                findings.map((f, i) => (
                  <div
                    className={`alert ${f.severity === 'Crítico' ? 'r' : f.severity === 'Alto' ? 'y' : 'b'}`}
                    key={i}
                  >
                    <b>{f.severity}</b> · {f.title}
                    {f.detail ? <span className="mini"> — {f.detail}</span> : null}
                  </div>
                ))}
              {analysisMode === 'gemini' && recommendation && (
                <div className="alert g">
                  <b>Recomendación:</b> {recommendation}
                </div>
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
                  <SmartImage
                    className="opt-img"
                    src={systemImage(sysDef.key, 900)}
                    fallback={systemSvg(sysDef.key)}
                    alt={sysDef.name}
                  />
                  <PhotoCredit kind="system" id={sysDef.key} />
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
