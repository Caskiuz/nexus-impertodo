import data from './photos.json';

export interface PhotoCredit {
  base: string;
  photographer: string;
  page: string;
  id: string;
}

type PhotoData = {
  systems: Record<string, PhotoCredit>;
  elements: Record<string, PhotoCredit>;
};

const PHOTOS = data as PhotoData;

export function photoUrl(p: PhotoCredit, width = 1200): string {
  return `${p.base}?auto=format&fit=crop&w=${width}&q=80`;
}

export function systemPhoto(key: string): PhotoCredit | undefined {
  return PHOTOS.systems[key];
}

export function elementPhoto(slug: string): PhotoCredit | undefined {
  return PHOTOS.elements[slug];
}

export const UNSPLASH_HOME = 'https://unsplash.com';

export function allPhotos(): { kind: string; slug: string; photo: PhotoCredit }[] {
  return [
    ...Object.entries(PHOTOS.systems).map(([slug, photo]) => ({ kind: 'Sistema', slug, photo })),
    ...Object.entries(PHOTOS.elements).map(([slug, photo]) => ({ kind: 'Servicio', slug, photo }))
  ];
}
