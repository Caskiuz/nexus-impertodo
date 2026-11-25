'use client';

import { useEffect } from 'react';

/** Abre automáticamente la sección plegable apuntada por el hash (#kardex, #movimientos…). */
export default function InventorySectionsControls() {
  useEffect(() => {
    const openFromHash = () => {
      const id = window.location.hash.replace('#', '');
      if (!id) return;
      const el = document.getElementById(id);
      if (el instanceof HTMLDetailsElement) el.open = true;
    };

    // Clics en cualquier ancla interna: abre la sección destino aunque el hash no cambie
    // (p. ej. si ya estabas en #movimientos y vuelves a pulsar el chip).
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
      if (!a) return;
      const id = a.getAttribute('href')?.slice(1);
      if (!id) return;
      const el = document.getElementById(id);
      if (el instanceof HTMLDetailsElement) {
        window.setTimeout(() => {
          el.open = true;
        }, 0);
      }
    };

    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('hashchange', openFromHash);
      document.removeEventListener('click', onClick);
    };
  }, []);

  function setAll(open: boolean) {
    document.querySelectorAll('details[data-inv-section]').forEach((d) => {
      if (d instanceof HTMLDetailsElement) d.open = open;
    });
  }

  return (
    <>
      <button className="btn sm" type="button" onClick={() => setAll(true)} title="Desplegar todas las secciones de abajo">
        ⬇ Abrir todo
      </button>
      <button className="btn sm" type="button" onClick={() => setAll(false)} title="Plegar todas las secciones">
        ⬆ Cerrar todo
      </button>
    </>
  );
}
