import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'IMPERTODO AI OS · by Nexus',
  description:
    'Sistema operativo de impermeabilización: cotizador, CRM, obra, inventario, finanzas y red de franquicias con regalías y comisión del desarrollador.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
