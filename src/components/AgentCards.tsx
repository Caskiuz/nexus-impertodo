'use client';

import { useState } from 'react';

const AGENTS = [
  { key: 'documentos', icon: '📄', title: 'Agente de documentos', desc: 'lee XML, detecta duplicados por UUID y clasifica borradores.', badge: 'No contabiliza' },
  { key: 'comercial', icon: '💬', title: 'Agente comercial', desc: 'detecta cotizaciones sin respuesta y sugiere seguimiento.', badge: 'No envía solo' },
  { key: 'tecnico', icon: '🔧', title: 'Agente técnico', desc: 'valida espesores, fichas y coherencia del procedimiento.', badge: 'No autoriza' },
  { key: 'financiero', icon: '💰', title: 'Agente financiero', desc: 'margen bajo piso, gastos anómalos, 69-B.', badge: 'No paga' },
  { key: 'compras', icon: '🛒', title: 'Agente de compras', desc: 'reposición bajo mínimo y comparación de costo instalado.', badge: 'No compra' },
  { key: 'licitaciones', icon: '🏛️', title: 'Agente de licitaciones', desc: 'puntúa coincidencia con experiencia y certificaciones.', badge: 'No envía' }
];

interface Result {
  text: string;
  mode: string;
  loading?: boolean;
}

export default function AgentCards() {
  const [results, setResults] = useState<Record<string, Result>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string) {
    if (busy) return;
    setBusy(key);
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
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="grid-3">
        {AGENTS.map((a) => (
          <button
            key={a.key}
            type="button"
            className="agent agent-btn"
            onClick={() => run(a.key)}
            disabled={Boolean(busy)}
            title="Ejecutar este agente con IA"
          >
            <span className="ic">{a.icon}</span>
            <span className="t">
              <b>{a.title}</b> — {a.desc} <span className="badge warn">{a.badge}</span>
              <span className="run">{busy === a.key ? 'Analizando con IA…' : 'Ejecutar análisis IA →'}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="mini" style={{ marginTop: 8 }}>
        Haz clic en una tarjeta para ejecutar su análisis con IA. El resultado aparece debajo de las tarjetas, no en la
        bitácora ni en los eventos de negocio (esos son registros auditables).
      </div>

      {Object.keys(results).length > 0 && (
        <div className="card panel" style={{ marginTop: 14 }}>
          <div className="sec">
            Resultados de los agentes <span className="badge info">IA · datos en vivo</span>
          </div>
          {AGENTS.filter((a) => results[a.key]).map((a) => {
            const r = results[a.key];
            return (
              <div className="alert b" key={a.key}>
                <b>
                  {a.icon} {a.title}
                </b>{' '}
                <span className={`badge ${r.mode === 'gemini' ? 'ok' : 'warn'}`}>
                  {r.loading ? 'Analizando…' : r.mode === 'gemini' ? 'IA' : 'Respaldo'}
                </span>
                <div style={{ whiteSpace: 'pre-line', marginTop: 6, fontSize: 12.5 }}>
                  {r.loading ? 'Leyendo tus datos y generando el análisis…' : r.text}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
