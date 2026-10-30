'use client';

import { useState } from 'react';

interface Msg {
  who: 'bot' | 'user';
  text: string;
}

const replies: { match: RegExp; reply: string }[] = [
  { match: /cobr|debe|adeuda/i, reply: 'Tienes 3 facturas por cobrar ($412K, $96K vencido). Abre "Cobrar" para ver el detalle y los recordatorios. Recuerda: el envío real por WhatsApp se activa en fase 2.' },
  { match: /cotiz|m2|m²|metro/i, reply: 'Ve a "Cotizar" (o usa la barra de comandos: "cotiza 300 m2 acrílico 10 para OXXO"). El motor calcula área desarrollada, costo, margen contra el piso del 30% y valida antes de enviar.' },
  { match: /factura|gasto|xml|cfdi|ticket/i, reply: 'En "Caja / Contabilidad" puedes capturar gastos o registrar XML CFDI. Un UUID duplicado se bloquea. La IA clasifica; tú apruebas; nada se contabiliza solo.' },
  { match: /obra|ot|fase/i, reply: 'En "Obra / OT" cada fase se comprueba con foto + m². La OT nace al aprobar una cotización y al entregar se genera la garantía digital.' },
  { match: /franquicia|regal|red|central/i, reply: 'En "Franquicias" está la red: Torreón (matriz), Monterrey (piloto) y Querétaro (prospecto). Regalía 6% + marketing 2% sobre ventas timbradas y fee tecnológico de $2,500/mes. La central ve todo desde "Central (red)".' },
  { match: /margen|precio|costo/i, reply: 'El margen real se calcula como (venta − costo) / venta. El piso está en 30%: por debajo requiere autorización de gerencia. El catálogo maestro alimenta todos los cálculos.' },
  { match: /hola|buen|ayuda/i, reply: 'Hola 👋 Soy el asistente de IMPERTODO AI OS. Puedo decirte dónde encontrar cobranza, cotizaciones, facturas, obra, red de franquicias o el panel de comisión del desarrollador.' }
];

export default function Assistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([
    { who: 'bot', text: 'Hola 👋 Puedo guiarte por cotizaciones, cobranza, facturas, obra o la red de franquicias. ¿Qué necesitas?' }
  ]);

  function send() {
    const text = input.trim();
    if (!text) return;
    setInput('');
    setMsgs((m) => [...m, { who: 'user', text }]);
    const found = replies.find((r) => r.match.test(text));
    const reply = found
      ? found.reply
      : 'En producción respondería con tu catálogo e historial. Prueba el cotizador, la caja, la red de franquicias o la barra de comandos.';
    window.setTimeout(() => setMsgs((m) => [...m, { who: 'bot', text: reply }]), 350);
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
            <div className="s">en línea · reglas reales, sin inventar</div>
          </div>
        </div>
        <div className="as-body">
          {msgs.map((m, i) => (
            <div key={i} className={`msg ${m.who}`}>
              {m.text}
            </div>
          ))}
        </div>
        <div className="as-foot">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send();
            }}
            placeholder="Pregunta o escribe una orden…"
          />
          <button onClick={send} aria-label="Enviar">
            ➤
          </button>
        </div>
      </div>
    </>
  );
}
