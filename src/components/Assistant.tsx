'use client';

import { useState } from 'react';

interface Msg {
  who: 'bot' | 'user';
  text: string;
}

const fallbacks: { match: RegExp; reply: string }[] = [
  { match: /cobr|debe|adeuda/i, reply: 'Tienes facturas por cobrar en el módulo Cobrar. Ahí ves vencidos y registras recordatorios; el cobro se marca manualmente.' },
  { match: /cotiz|m2|m²|precio/i, reply: 'Abre Cotizar: el wizard calcula área desarrollada, costos, margen contra el piso y valida antes de enviar. También puedes usar la barra de comandos.' },
  { match: /factura|gasto|xml|cfdi|ticket/i, reply: 'En Caja puedes capturar gastos o subir XML CFDI; los UUID duplicados se bloquean y requiere revisión de Administración y Gerencia.' },
  { match: /obra|ot|fase/i, reply: 'En Obra/OT avanzas fases con evidencia, controlas consumo teórico vs real y entregas con garantía digital.' },
  { match: /franquicia|regal|red|central/i, reply: 'En Franquicias ves la red y sus reglas; en Central registras ventas timbradas, regalías 6%+2% y fees. La comisión del 20% se devenga sola.' },
  { match: /margen|piso/i, reply: 'El margen se calcula como (venta − costo) / venta. Por debajo del piso requiere autorización de Gerencia; el catálogo define el piso.' }
];

const suggestions = ['¿Qué debo atender hoy?', '¿Cómo va la red de franquicias?', '¿Cuánto hay por cobrar?'];

export default function Assistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      who: 'bot',
      text: 'Hola 👋 Soy el asistente con IA de IMPERTODO AI OS. Puedo leer tus indicadores actuales y guiarte por cotizaciones, cobranza, obra o la red de franquicias. ¿Qué necesitas?'
    }
  ]);

  async function send(text?: string) {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    setInput('');
    setMsgs((m) => [...m, { who: 'user', text: message }]);
    setBusy(true);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      if (!res.ok) throw new Error('respuesta no válida');
      const data = await res.json();
      if (!data.reply) throw new Error('sin respuesta');
      setMsgs((m) => [...m, { who: 'bot', text: String(data.reply) }]);
    } catch {
      const found = fallbacks.find((r) => r.match.test(message));
      setMsgs((m) => [
        ...m,
        {
          who: 'bot',
          text:
            (found ? found.reply : 'No pude conectar con la IA en este momento. Puedo guiarte por los módulos: Hoy, Cotizar, Obra, Caja, Cobrar, Franquicias y Central.') +
            ''
        }
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="fab" onClick={() => setOpen((v) => !v)} title="Asistente IA">
        🤖
      </button>
      <div className={`assistant ${open ? 'on' : ''}`}>
        <div className="as-head">
          <div>
            <div className="t">Asistente IA · PROSEALMASTER</div>
            <div className="s">IA · datos en vivo de tu operación</div>
          </div>
        </div>
        <div className="as-body">
          {msgs.map((m, i) => (
            <div key={i} className={`msg ${m.who}`}>
              {m.text}
            </div>
          ))}
          {busy && <div className="msg bot typing">Escribiendo…</div>}
          {msgs.length === 1 && (
            <div className="as-chips">
              {suggestions.map((s) => (
                <button key={s} type="button" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="as-foot">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send();
            }}
            placeholder="Pregunta sobre tu operación…"
            disabled={busy}
          />
          <button onClick={() => send()} aria-label="Enviar" disabled={busy}>
            ➤
          </button>
        </div>
      </div>
    </>
  );
}
