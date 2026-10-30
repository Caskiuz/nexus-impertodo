'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function CommandBar() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [toast, setToast] = useState('');

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2600);
  }

  function run(raw: string) {
    const q = raw.trim();
    if (!q) return;
    setValue('');
    const lower = q.toLowerCase();

    const m = lower.match(/(?:cotiza\w*)\s+(\d+(?:[.,]\d+)?)\s*m2?\s*(acr[ií]lico|sbs|rollo|poliuretano|poliurea|silicona|epox\w*|cement\w*|aisl\w*)?(?:\s*(7|10))?(?:\s+para\s+(.+))?/);
    if (m) {
      const map: Record<string, string> = {
        acr: 'acr10', sbs: 'sbs45', rollo: 'sbs45', poliuretano: 'pu', poliurea: 'polu',
        silicona: 'sil', epox: 'epx', cement: 'cem', aisl: 'ais'
      };
      const token = m[2] || 'sbs';
      const prefix = Object.keys(map).find((k) => token.startsWith(k));
      let sys = prefix ? map[prefix] : 'sbs45';
      if ((token.startsWith('acr') || token.startsWith('acr') || token.includes('acr')) && m[3] === '7') sys = 'acr7';
      const client = m[4] ? m[4].replace(/\b\w/g, (c) => c.toUpperCase()) : '';
      const area = m[1].replace(',', '.');
      const params = new URLSearchParams({ area, sys });
      if (client) params.set('client', client);
      flash('Cotización preparada: ' + area + ' m²');
      router.push('/cotizar?' + params.toString());
      return;
    }
    if (lower.includes('debe') || lower.includes('cobrar')) {
      const name = lower.replace(/.*(debe|cobrar)\s*/, '').trim();
      flash('Abriendo Cobrar');
      router.push('/cobrar' + (name ? '?q=' + encodeURIComponent(name) : ''));
      return;
    }
    if (lower.includes('agenda') || lower.includes('visita')) {
      flash('Visita agendada (demo) · recordatorio al supervisor');
      return;
    }
    if (lower.includes('licit')) {
      router.push('/licitaciones');
      return;
    }
    if (lower.includes('factura') || lower.includes('gasto') || lower.includes('ticket')) {
      router.push('/caja');
      return;
    }
    if (lower.includes('obra')) {
      router.push('/obra');
      return;
    }
    if (lower.includes('franquicia') || lower.includes('central') || lower.includes('red')) {
      router.push('/franquicias');
      return;
    }
    flash('No entendí. Ejemplos: "cotiza 300 m2 acrílico 10 para OXXO", "cuánto debe LALA", "agenda visita viernes"');
  }

  return (
    <>
      <div className="cmd">
        <input
          placeholder='Escribe o dicta: "cotiza 300 m² acrílico para OXXO" · "cuánto debe LALA" · "agenda visita viernes"'
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') run(value);
          }}
          aria-label="Barra de comandos"
        />
        <button
          type="button"
          title="Dictar por voz"
          onClick={() => {
            flash('Dictado por voz: escribe el comando y presiona Enter');
            runnerFallback(run);
          }}
        >
          🎙
        </button>
      </div>
      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </>
  );
}

function runnerFallback(run: (v: string) => void) {
  const w = window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike; SpeechRecognition?: new () => SpeechRecognitionLike };
  const Rec = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Rec) return;
  try {
    const rec = new Rec();
    rec.lang = 'es-MX';
    rec.onresult = (e) => {
      const text = e.results?.[0]?.[0]?.transcript || '';
      if (text) run(text);
    };
    rec.start();
  } catch {
    /* dictado no disponible */
  }
}

interface SpeechRecognitionLike {
  lang: string;
  onresult: (e: { results?: { [i: number]: { [j: number]: { transcript: string } } } }) => void;
  start: () => void;
}
