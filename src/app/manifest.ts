import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'IMPERTODO AI OS',
    short_name: 'Impertodo',
    description:
      'Sistema operativo de impermeabilización: cotizador, CRM, obra, inventario, finanzas y red de franquicias.',
    start_url: '/hoy',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#eef1f6',
    theme_color: '#0f2f47',
    lang: 'es-MX',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  };
}
