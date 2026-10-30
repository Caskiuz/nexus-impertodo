'use client';

import { useState } from 'react';

export default function PriorityAI() {
  const [state, setState] = useState<{ reply?: string; mode?: string; loading?: boolean }>({});

  async function run() {
    setState({ loading: true });
    try {
      const res = await fetch('/api/priorities', { method: 'POST' });
      const data = await res.json();
      setState({ reply: data.reply || 'Sin respuesta.', mode: data.mode || 'fallback' });
    } catch {
      setState({ reply: 'No pude conectar con la IA. Revisa los módulos con alertas.', mode: 'fallback' });
    }
  }

  return (
    <div style={{ marginTop: 4, marginBottom: 10 }}>
      <button className="btn sm azul" type="button" onClick={run} disabled={state.loading}>
        {state.loading ? 'Priorizando…' : '✨ Priorizar con IA'}
      </button>
      {state.reply && (
        <div className="alert b" style={{ marginTop: 9 }}>
          <span className={`badge ${state.mode === 'gemini' ? 'ok' : 'warn'}`}>{state.loading ? '…' : state.mode === 'gemini' ? 'IA' : 'Respaldo'}</span>
          <div style={{ whiteSpace: 'pre-line', marginTop: 6, fontSize: 12.5 }}>{state.reply}</div>
        </div>
      )}
    </div>
  );
}
