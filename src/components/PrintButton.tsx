'use client';

export default function PrintButton({ label = 'Imprimir / PDF' }: { label?: string }) {
  return (
    <button className="btn no-print" onClick={() => window.print()}>
      🖨 {label}
    </button>
  );
}
