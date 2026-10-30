export const systemImage = (key: string) => `/img/sistemas/${key}.svg`;

const ELEMENT_MAP: Record<string, string> = {
  'Losa de azotea no transitable': 'losa-no-transitable',
  'Losa transitable': 'losa-transitable',
  'Nave / lámina': 'nave',
  Cisterna: 'cisterna',
  'Muro / cimentación': 'muro',
  'Piso industrial': 'piso'
};

export const elementImage = (el: string) => `/img/elementos/${ELEMENT_MAP[el] ?? 'losa-no-transitable'}.svg`;

export function serviceImage(tipo: string): string {
  if (/nave/i.test(tipo)) return elementImage('Nave / lámina');
  if (/cisterna/i.test(tipo)) return elementImage('Cisterna');
  if (/comercial|oficina/i.test(tipo)) return elementImage('Losa transitable');
  if (/casa|residencial/i.test(tipo)) return elementImage('Losa de azotea no transitable');
  return elementImage('Losa de azotea no transitable');
}

export function inventoryImage(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('acrílico')) return systemImage(n.includes('7') ? 'acr7' : 'acr10');
  if (n.includes('rollo') || n.includes('sbs') || n.includes('membrana')) return systemImage('sbs45');
  if (n.includes('primer')) return systemImage('pu');
  if (n.includes('cemento')) return systemImage('cem');
  if (n.includes('poliurea')) return systemImage('polu');
  return '/img/productos/generico.svg';
}
