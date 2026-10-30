// Descarga candidatas de stock (Pexels o Unsplash) para el catálogo de Impertodo.
// Uso: node --env-file=.env scripts/fetch-stock-photos.mjs
// Requiere PEXELS_API_KEY o UNSPLASH_ACCESS_KEY. Salida: tmp-stock/ + meta.json
import fs from 'node:fs';

const PEXELS = process.env.PEXELS_API_KEY || '';
const UNSPLASH = process.env.UNSPLASH_ACCESS_KEY || '';
if (!PEXELS && !UNSPLASH) {
  console.error('Falta PEXELS_API_KEY (recomendado) o UNSPLASH_ACCESS_KEY en .env');
  process.exit(1);
}

const CONCEPTS = {
  acr10: 'paint bucket construction',
  acr7: 'painter bucket roof',
  sbs45: 'roof waterproofing membrane',
  pu: 'spray foam insulation roof',
  polu: 'industrial spray coating',
  sil: 'white roof coating',
  cem: 'cement waterproofing',
  ais: 'roof insulation construction',
  epx: 'epoxy floor',
  'losa-no-transitable': 'flat roof building',
  'losa-transitable': 'rooftop terrace',
  nave: 'warehouse metal roof',
  cisterna: 'concrete water tank',
  muro: 'retaining wall construction',
  piso: 'warehouse floor'
};

const dir = 'tmp-stock';
fs.mkdirSync(dir, { recursive: true });
const meta = [];

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

async function fromPexels(slug, term, count) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(term)}&per_page=${count}&orientation=landscape`;
  const res = await fetch(url, { headers: { Authorization: PEXELS } });
  if (!res.ok) throw new Error(`Pexels ${res.status} ${await res.text()}`);
  const json = await res.json();
  const photos = json.photos || [];
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    const preview = p.src?.large || p.src?.medium;
    const full = p.src?.large2x || p.src?.original || preview;
    if (!preview) continue;
    const file = `${dir}/${slug}-${i}.jpg`;
    try {
      await download(preview, file);
      meta.push({
        slug,
        i,
        provider: 'pexels',
        title: p.alt || term,
        photographer: p.photographer,
        page: p.url,
        full,
        width: p.width,
        height: p.height,
        file
      });
    } catch (e) {
      console.error('  preview', e.message);
    }
  }
}

async function fromUnsplash(slug, term, count) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(term)}&per_page=${count}&orientation=landscape&client_id=${UNSPLASH}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Unsplash ${res.status} ${await res.text()}`);
  const json = await res.json();
  const photos = json.results || [];
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    const preview = p.urls?.small;
    const full = p.urls?.raw ? `${p.urls.raw}&w=1600&q=85&fm=jpg&fit=max` : p.urls?.regular;
    if (!preview) continue;
    const file = `${dir}/${slug}-${i}.jpg`;
    try {
      await download(preview, file);
      meta.push({
        slug,
        i,
        provider: 'unsplash',
        title: p.alt_description || term,
        photographer: p.user?.name,
        page: p.links?.html,
        full,
        width: p.width,
        height: p.height,
        file
      });
    } catch (e) {
      console.error('  preview', e.message);
    }
  }
}

for (const [slug, term] of Object.entries(CONCEPTS)) {
  try {
    if (PEXELS) await fromPexels(slug, term, 4);
    else await fromUnsplash(slug, term, 4);
    console.log(`✓ ${slug} (${term})`);
  } catch (e) {
    console.error(`✗ ${slug}: ${String(e).slice(0, 160)}`);
  }
  await new Promise((r) => setTimeout(r, PEXELS ? 250 : 1200));
}

fs.writeFileSync(`${dir}/meta.json`, JSON.stringify(meta, null, 1));
console.log(`\n${meta.length} candidatas en ${dir}/ — revisar con la hoja de contactos.`);
