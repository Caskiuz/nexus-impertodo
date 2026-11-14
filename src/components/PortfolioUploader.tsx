'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { compressImageFile } from '@/lib/compress-image';

const ELEMENTS = [
  'Losa de azotea no transitable',
  'Losa transitable',
  'Nave / lámina',
  'Cisterna',
  'Muro / cimentación',
  'Piso industrial'
];

export default function PortfolioUploader({
  clientName,
  element,
  otCode
}: {
  clientName?: string;
  element?: string;
  otCode?: string;
}) {
  const router = useRouter();
  const [client, setClient] = useState(clientName || '');
  const [elem, setElem] = useState(element || ELEMENTS[0]);
  const [title, setTitle] = useState('');
  const [before, setBefore] = useState<string | null>(null);
  const [after, setAfter] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);

  async function pick(file: File | undefined, side: 'before' | 'after') {
    try {
      const dataUrl = await compressImageFile(file);
      if (side === 'before') setBefore(dataUrl);
      else setAfter(dataUrl);
      setMsg(null);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message || 'No pude leer la imagen.' });
    }
  }

  async function publish() {
    if (busy) return;
    if (!client.trim()) {
      setMsg({ ok: false, text: 'Escribe el nombre del cliente.' });
      return;
    }
    if (!before && !after) {
      setMsg({ ok: false, text: 'Sube al menos una foto (antes o después).' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: client.trim(),
          element: elem,
          title: title.trim() || undefined,
          before: before || undefined,
          after: after || undefined,
          otCode: otCode || undefined
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'error');
      setMsg({ ok: true, text: 'Evidencia publicada en el portafolio.' });
      setBefore(null);
      setAfter(null);
      setTitle('');
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message || 'No pude publicar la evidencia.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="row3">
        <div className="field">
          <label>Cliente</label>
          <input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Ej. OXXO · Sucursal Torreón Centro" />
        </div>
        <div className="field">
          <label>Tipo de área</label>
          <select value={elem} onChange={(e) => setElem(e.target.value)}>
            {ELEMENTS.map((e2) => (
              <option key={e2}>{e2}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Título (opcional)</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Acrílico 10 años · 285 m²" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '8px 0' }}>
        <div>
          <div className="mini" style={{ marginBottom: 4 }}>ANTES</div>
          {before && <img src={before} alt="Antes" style={{ width: 150, height: 100, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--linea)', display: 'block', marginBottom: 6 }} />}
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn sm" type="button" onClick={() => beforeRef.current?.click()} disabled={busy}>
              📁 {before ? 'Cambiar' : 'Subir'} antes
            </button>
          </div>
          <input ref={beforeRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0], 'before')} />
        </div>
        <div>
          <div className="mini" style={{ marginBottom: 4 }}>DESPUÉS</div>
          {after && <img src={after} alt="Después" style={{ width: 150, height: 100, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--linea)', display: 'block', marginBottom: 6 }} />}
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn sm" type="button" onClick={() => afterRef.current?.click()} disabled={busy}>
              📁 {after ? 'Cambiar' : 'Subir'} después
            </button>
          </div>
          <input ref={afterRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0], 'after')} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn primary" type="button" onClick={publish} disabled={busy}>
          {busy ? 'Publicando…' : 'Publicar al portafolio'}
        </button>
        {otCode && <span className="badge info">{otCode}</span>}
        <span className="mini">Funciona en PC y celular. Las fotos se comprimen solas antes de guardarse.</span>
      </div>
      {msg && <div className={msg.ok ? 'alert g' : 'alert r'} style={{ marginTop: 8 }}>{msg.text}</div>}
    </div>
  );
}
