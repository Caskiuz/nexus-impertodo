// Genera fotos fotorrealistas de producto/servicio con la API de Gemini (Google AI Studio).
// Uso: node --env-file=.env scripts/generate-photos.mjs [slug ...]
// Requiere GEMINI_API_KEY (o GOOGLE_API_KEY). Salida: public/img/fotos/src/<slug>.png
import fs from 'node:fs/promises';
import path from 'node:path';

const KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
if (!KEY) {
  console.error('Falta GEMINI_API_KEY. Agrega GEMINI_API_KEY=... en .env y vuelve a ejecutar.');
  process.exit(1);
}

const OUT_DIR = 'public/img/fotos/src';
const STYLE =
  'Photorealistic professional commercial photography, high detail, natural lighting, clean composition, no text, no logos, no watermarks, no people, 4:3 landscape.';

const PROMPTS = {
  acr10:
    'A white 19-liter plastic bucket of white acrylic waterproofing coating with a paint roller leaning against it, on the flat concrete roof of a building, soft daylight, clean modern setting.',
  acr7:
    'A light-gray 19-liter plastic bucket with a green lid of acrylic elastomeric waterproofing coating, next to a roller and a small trowel, on a flat roof, soft daylight.',
  sbs45:
    'A roll of white mineral-surfaced SBS bitumen waterproofing membrane installed on a flat roof, partially unrolled strip with visible granulated surface, a gas torch on the roof beside it, daylight.',
  pu:
    'Spray polyurethane foam being applied to a flat concrete roof with a professional spray gun, thick white insulating foam layer, construction site, daylight.',
  polu:
    'Industrial polyurea spray application on a large steel tank surface, dark gray-blue coating, fine spray mist, professional industrial photography, daylight.',
  sil:
    'White reflective silicone roof coating being applied with a roller on a flat roof under bright sunlight, glossy white reflective surface, clear sky.',
  cem:
    'Flexible cementitious waterproofing coating applied with a steel trowel on a concrete cistern wall, smooth gray layer, construction detail, daylight.',
  ais:
    'Close-up cutaway of a roof insulation system showing white reflective acrylic coating over an insulating foam layer and a reinforced membrane, clean technical detail, daylight.',
  epx:
    'Industrial epoxy floor coating application with a roller, glossy blue-gray floor in a warehouse, clean industrial environment, daylight.',
  'losa-no-transitable':
    'Flat concrete rooftop with low parapet walls, a roof drain and a small vent pipe, waterproofed white surface, clear blue sky, architectural photography.',
  'losa-transitable':
    'Trafficable rooftop terrace with waterproofed gray floor, glass railing, wooden planters and outdoor furniture, sunny day, architectural photography.',
  nave:
    'Industrial warehouse building with a standing-seam metal roof, wide-angle exterior view, maintenance-ready roof, daylight.',
  cisterna:
    'Underground concrete water cistern interior with blue waterproof coating and clear water at the bottom, cutaway view with access hatch, construction photography.',
  muro:
    'Concrete retaining wall with blue waterproof coating partially applied with a trowel, construction detail, daylight.',
  piso:
    'Industrial warehouse floor with a freshly applied glossy epoxy coating, a roller resting on the surface, clean and reflective, daylight.'
};

function pickImageModel(models) {
  const names = models.map((m) => m.name?.replace('models/', '')).filter(Boolean);
  const preferred = [
    'gemini-2.5-flash-image',
    'gemini-2.5-flash-image-preview',
    'gemini-3-pro-image-preview',
    'gemini-3-pro-image',
    'gemini-2.0-flash-exp-image-generation'
  ];
  for (const p of preferred) if (names.includes(p)) return p;
  return names.find((n) => n.includes('image')) || null;
}

async function listModels() {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${KEY}&pageSize=200`);
  if (!res.ok) throw new Error(`No pude listar modelos: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.models || [];
}

async function generateWithGemini(model, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEY}`;
  const bodies = [
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '4:3' } }
    },
    { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } },
    { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'] } }
  ];
  let last = '';
  for (const body of bodies) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    if (!res.ok) {
      last = `HTTP ${res.status}: ${text.slice(0, 300)}`;
      if (res.status === 429) throw new Error(last);
      continue;
    }
    const json = JSON.parse(text);
    const parts = json.candidates?.[0]?.content?.parts || [];
    const img = parts.find((p) => p.inlineData?.data);
    if (img) return Buffer.from(img.inlineData.data, 'base64');
    last = `Respuesta sin imagen: ${text.slice(0, 300)}`;
  }
  throw new Error(last);
}

async function generateWithImagen(model, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio: '4:3' } })
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Imagen HTTP ${res.status}: ${text.slice(0, 300)}`);
  const json = JSON.parse(text);
  const b64 = json.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error(`Imagen sin bytes: ${text.slice(0, 300)}`);
  return Buffer.from(b64, 'base64');
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const models = await listModels();
  const geminiModel = pickImageModel(models);
  const imagenModels = models
    .map((m) => m.name?.replace('models/', ''))
    .filter((n) => n && n.startsWith('imagen'));
  const imagenModel = imagenModels.find((n) => n.includes('4.0')) || imagenModels[0] || null;

  console.log('Modelo Gemini de imagen:', geminiModel || 'no disponible');
  console.log('Modelo Imagen:', imagenModel || 'no disponible');
  if (!geminiModel && !imagenModel) {
    throw new Error('Tu key no tiene acceso a ningún modelo de generación de imágenes.');
  }

  const only = process.argv.slice(2);
  const slugs = Object.keys(PROMPTS).filter((s) => !only.length || only.includes(s));

  for (const slug of slugs) {
    const prompt = `${PROMPTS[slug]} ${STYLE}`;
    const file = path.join(OUT_DIR, `${slug}.png`);
    try {
      let buf;
      if (geminiModel) {
        try {
          buf = await generateWithGemini(geminiModel, prompt);
        } catch (e) {
          if (!imagenModel) throw e;
          console.warn(`  Gemini falló (${String(e).slice(0, 140)}), probando Imagen…`);
          buf = await generateWithImagen(imagenModel, prompt);
        }
      } else {
        buf = await generateWithImagen(imagenModel, prompt);
      }
      await fs.writeFile(file, buf);
      console.log(`✓ ${slug} (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (e) {
      console.error(`✗ ${slug}: ${String(e).slice(0, 300)}`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
