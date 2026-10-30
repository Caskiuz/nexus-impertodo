import { systemPhoto, elementPhoto, photoUrl } from './photos';

const ELEMENT_MAP: Record<string, string> = {
  'Losa de azotea no transitable': 'losa-no-transitable',
  'Losa transitable': 'losa-transitable',
  'Nave / lámina': 'nave',
  Cisterna: 'cisterna',
  'Muro / cimentación': 'muro',
  'Piso industrial': 'piso'
};

const elementSlug = (el: string) => ELEMENT_MAP[el] ?? 'losa-no-transitable';

/** Foto de Unsplash (hotlink) con respaldo a la ilustración SVG. */
export const systemImage = (key: string, width = 1200): string => {
  const p = systemPhoto(key);
  return p ? photoUrl(p, width) : `/img/sistemas/${key}.svg`;
};

export const elementImage = (el: string, width = 1200): string => {
  const slug = elementSlug(el);
  const p = elementPhoto(slug);
  return p ? photoUrl(p, width) : `/img/elementos/${slug}.svg`;
};

export const systemCredit = (key: string) => systemPhoto(key);
export const elementCredit = (el: string) => elementPhoto(elementSlug(el));

export const systemSvg = (key: string) => `/img/sistemas/${key}.svg`;
export const elementSvg = (el: string) => `/img/elementos/${elementSlug(el)}.svg`;

export function serviceSvg(tipo: string): string {
  if (/nave/i.test(tipo)) return elementSvg('Nave / lámina');
  if (/cisterna/i.test(tipo)) return elementSvg('Cisterna');
  if (/comercial|oficina/i.test(tipo)) return elementSvg('Losa transitable');
  return elementSvg('Losa de azotea no transitable');
}

export function inventorySvg(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('acrílico')) return systemSvg(n.includes('7') ? 'acr7' : 'acr10');
  if (n.includes('rollo') || n.includes('sbs') || n.includes('membrana')) return systemSvg('sbs45');
  if (n.includes('cemento')) return systemSvg('cem');
  if (n.includes('poliurea')) return systemSvg('polu');
  return '/img/productos/generico.svg';
}

export function serviceImage(tipo: string, width = 640): string {
  if (/nave/i.test(tipo)) return elementImage('Nave / lámina', width);
  if (/cisterna/i.test(tipo)) return elementImage('Cisterna', width);
  if (/comercial|oficina/i.test(tipo)) return elementImage('Losa transitable', width);
  if (/casa|residencial/i.test(tipo)) return elementImage('Losa de azotea no transitable', width);
  return elementImage('Losa de azotea no transitable', width);
}

export function inventoryImage(name: string, width = 480): string {
  const n = name.toLowerCase();
  if (n.includes('acrílico')) return systemImage(n.includes('7') ? 'acr7' : 'acr10', width);
  if (n.includes('rollo') || n.includes('sbs') || n.includes('membrana')) return systemImage('sbs45', width);
  if (n.includes('cemento')) return systemImage('cem', width);
  if (n.includes('poliurea')) return systemImage('polu', width);
  return '/img/productos/generico.svg';
}
