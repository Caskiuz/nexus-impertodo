'use client';

import { useState } from 'react';

export default function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn sm"
      type="button"
      onClick={() => {
        const url = window.location.origin + path;
        navigator.clipboard
          .writeText(url)
          .then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2200);
          })
          .catch(() => {
            window.prompt('Copia el enlace:', url);
          });
      }}
    >
      {copied ? '✓ Copiado' : 'Copiar enlace'}
    </button>
  );
}
