'use client';

import { useState } from 'react';

const AGENTS = [
  { key: 'documentos', label: 'Documentos', icon: '📄' },
  { key: 'comercial', label: 'Comercial', icon: '💬' },
  { key: 'tecnico', label: 'Técnico', icon: '🔧' },
  { key: 'financiero', label: 'Financiero', icon: '💰' },
  { key: 'compras', label: 'Compras', icon: '🛒' },
  { key: 'licitaciones', label: 'Licitaciones', icon: '🏛️' }
];

interface Result {
  text: string;
  mode: string;
  loading?: boolean;
}

export default function AgentPanel() {
  const [results, setResults] = useState<Record<string, Result>>({});

  async function run(key: string) {
    setResults((r) => ({ ...r, [key]: { text: '', mode: '', loading: true } }));
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: key })
      });
      const data = await res.json();
      setResults((r) => ({
        ...r,
        [key]: { text: data.reply || 'Sin respuesta.', mode: data.mode || 'fallback' }
      }));
    } catch {
      setResults((r) => ({
        ...r,
        [key]: { text: 'No pude conectar con el agente. Revisa el módulo correspondiente.', mode: 'fallback' }
      }));
    }
  }

  return (
    <div className="card panel" style={{ marginTop: 14 }}>
      <div className="sec">
        Ejecutar agentes con Gemini <span className="badge info">IA real · datos en vivo</span>
      </div>
      <div className="mini">
        Cada agente lee tus datos actuales (comprobantes, embudo, cotizaciones, inventario o licitaciones) y genera
        recomendaciones. Sugiere; tú decides. Nada se envía, paga ni contabiliza solo.
      </div>
      <div className="actions" style={{ marginTop: 10 }}>
        {AGENTS.map((a) => (
          <button
            key={a.key}
            type="button"
            className="btn sm"
            onClick={() => run(a.key)}
            disabled={Boolean(results[a.key]?.loading)}
          >
            {a.icon} {a.label}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 10 }}>
        {AGENTS.filter((a) => results[a.key]).map((a) => {
          const r = results[a.key];
          return (
            <div className="alert b" key={a.key}>
              <b>
                {a.icon} {a.label}
              </b>{' '}
              <span className={`badge ${r.mode === 'gemini' ? 'ok' : 'warn'}`}>
                {r.loading ? 'Analizando…' : r.mode === 'gemini' ? 'Gemini' : 'Respaldo'}
              </span>
              <div style={{ whiteSpace: 'pre-line', marginTop: 6, fontSize: 12.5 }}>
                {r.loading ? 'Leyendo tus datos y generando el análisis…' : r.text}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
