'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const MAX_FILE = 12 * 1024 * 1024; // 12 MB antes de comprimir

export default function ProductPhotoManager({ itemId, name, current }: { itemId: string; name: string; current: string | null }) {
  const router = useRouter();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMsg({ ok: false, text: 'El archivo debe ser una imagen (JPG, PNG, WEBP…).' });
      return;
    }
    if (file.size > MAX_FILE) {
      setMsg({ ok: false, text: 'La imagen pesa más de 12 MB. Elige una más ligera.' });
      return;
    }
    setMsg(null);
    try {
      const dataOriginal = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onloadend = () => res(String(reader.result));
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const image = new Image();
        image.onload = () => res(image);
        image.onerror = () => rej(new Error('imagen ilegible'));
        image.src = dataOriginal;
      });
      const maxSide = 1000;
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.drawImage(img, 0, 0, w, h);
      setDataUrl(canvas.toDataURL('image/jpeg', 0.82));
    } catch {
      setMsg({ ok: false, text: 'No pude leer la imagen. Intenta con otra.' });
    }
  }

  async function save(remove = false) {
    if (busy) return;
    if (!remove && !dataUrl) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/products/photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, image: remove ? undefined : dataUrl, remove })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'error');
      setMsg({ ok: true, text: remove ? 'Foto eliminada.' : 'Foto guardada.' });
      setDataUrl(null);
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message || 'No pude guardar la foto.' });
    } finally {
      setBusy(false);
    }
  }

  const preview = dataUrl || current;

  return (
    <div>
      {preview && (
        <img
          src={preview}
          alt={`Foto de ${name}`}
          style={{ width: 180, height: 120, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--linea)', display: 'block', marginBottom: 10 }}
        />
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <button className="btn sm" type="button" onClick={() => galleryRef.current?.click()} disabled={busy}>
          📁 Galería / archivos (PC)
        </button>
        <button className="btn sm" type="button" onClick={() => cameraRef.current?.click()} disabled={busy}>
          📷 Tomar foto (celular)
        </button>
        {dataUrl && (
          <button className="btn sm primary" type="button" onClick={() => save(false)} disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar foto'}
          </button>
        )}
        {current && !dataUrl && (
          <button className="btn sm" type="button" onClick={() => save(true)} disabled={busy} style={{ color: 'var(--rojo)' }}>
            Quitar foto
          </button>
        )}
      </div>
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <div className="mini">
        Funciona en PC (elige el archivo) y en celular (te ofrece cámara o galería). La imagen se comprime sola antes de
        guardarse.
      </div>
      {msg && <div className={msg.ok ? 'alert g' : 'alert r'} style={{ marginTop: 8 }}>{msg.text}</div>}
    </div>
  );
}
