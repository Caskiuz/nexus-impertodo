'use client';

import { useState } from 'react';

export default function HelpModal() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn sm hide-m" onClick={() => setOpen(true)}>
        🎓 Ayuda
      </button>
      <div className={`modal ${open ? 'on' : ''}`} onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
        <div className="modal-box">
          <div className="modal-head">
            <div>
              <span className="badge ok">Capacitación rápida</span>
              <h2 style={{ marginTop: 6, color: 'var(--azul-700)', fontSize: 18 }}>Bienvenido a IMPERTODO AI OS</h2>
              <div style={{ fontSize: 12.5, color: 'var(--gris)', marginTop: 3 }}>
                Completa, avanzada y simple. Cinco minutos para entenderla.
              </div>
            </div>
            <button className="btn sm" onClick={() => setOpen(false)}>
              Cerrar
            </button>
          </div>
          <div className="modal-body">
            <div className="onb">
              <span className="n">1</span>
              <div>
                <h4>Cotizar</h4>
                <p>Cliente → medición → diagnóstico → precio con margen → propuesta. El margen se calcula solo y el validador bloquea errores.</p>
              </div>
            </div>
            <div className="onb">
              <span className="n">2</span>
              <div>
                <h4>Caja</h4>
                <p>Captura, XML o foto se convierten en borradores revisables. La IA clasifica; tú apruebas. Nada se contabiliza solo.</p>
              </div>
            </div>
            <div className="onb">
              <span className="n">3</span>
              <div>
                <h4>Obra</h4>
                <p>Regla de 60 segundos: foto + fase + m² y listo. Al entregar se genera garantía digital.</p>
              </div>
            </div>
            <div className="onb">
              <span className="n">4</span>
              <div>
                <h4>Red de franquicias</h4>
                <p>Regalía 6% + marketing 2% sobre ventas timbradas, fee tecnológico $2,500/mes y compra exclusiva PROSEALMASTER. La comisión del desarrollador (20%) se registra en automático.</p>
              </div>
            </div>
            <div className="alert y" style={{ marginBottom: 0 }}>
              Regla de oro: <b>la IA sugiere, el humano aprueba</b>. La plataforma no contabiliza, no paga, no timbra y no envía sola.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
