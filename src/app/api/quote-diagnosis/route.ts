import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { askGeminiVision, type GeminiResult } from '@/lib/gemini';

export interface DiagnosisFinding {
  severity: 'Crítico' | 'Alto' | 'Medio';
  title: string;
  detail: string;
}

const SYSTEM =
  'Eres el inspector técnico de Impertodo, empresa de impermeabilización con 45 años en Torreón, Coahuila. ' +
  'Recibes fotos del área a cotizar (losa de azotea, nave/lámina, muro, cisterna o piso industrial). ' +
  'Identifica daños de impermeabilización: encharcamiento o pendiente insuficiente, acrílico ampollado o despegado, fisuras en pretil o losa, ' +
  'bajantes y domos dañados o sin refuerzo, óxido o corrosión en lámina, traslapes mal sellados, material envejecido o sucio que requiera hidrolavado. ' +
  'Sé concreto y basado solo en lo visible; nunca inventes daños que no se ven. ' +
  'Responde EXACTAMENTE en este formato, sin markdown ni encabezados, máximo 5 hallazgos: ' +
  'HALLAZGO: <Crítico|Alto|Medio> · <título corto>\\nDETALLE: <1 frase con la evidencia de la foto>\\n' +
  '(repite HALLAZGO y DETALLE por cada daño)\\nRECOMENDACION: <sistema o acción recomendada, 1-2 frases>';

function parseFindings(text: string): { findings: DiagnosisFinding[]; recommendation: string } {
  const findings: DiagnosisFinding[] = [];
  const seen = new Set<string>();
  const re = /HALLAZGO:\s*([^\n]+)\n\s*DETALLE:\s*([^\n]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = m[1].trim();
    let severity: DiagnosisFinding['severity'] = 'Medio';
    let title = raw;
    const sevMatch = raw.match(/Crítico|Alto|Medio/i);
    if (sevMatch) {
      const s = sevMatch[0].toLowerCase();
      severity = s === 'crítico' || s === 'critico' ? 'Crítico' : s === 'alto' ? 'Alto' : 'Medio';
      title = raw.replace(/^(Crítico|Alto|Medio)\s*[·:\-–]*/i, '').trim();
    }
    const key = title.toLowerCase();
    if (title && !seen.has(key)) {
      seen.add(key);
      findings.push({ severity, title: title.slice(0, 120), detail: m[2].trim().slice(0, 240) });
    }
    if (findings.length >= 5) break;
  }
  // La recomendación termina donde la IA (fuera de formato) vuelve a emitir HALLAZGO/DETALLE.
  const recMatch = text.match(/RECOMENDACION:\s*([\s\S]*?)(?=\n\s*(?:HALLAZGO|DETALLE):|$)/i);
  return { findings, recommendation: recMatch ? recMatch[1].trim().slice(0, 400) : '' };
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  let payload: { photoIds?: string[]; element?: string; planta?: number };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const photoIds = (payload.photoIds || []).slice(0, 8);
  if (!photoIds.length) {
    return NextResponse.json({ error: 'Adjunta al menos una foto del área antes de analizar.' }, { status: 400 });
  }

  const photos = await prisma.quotePhoto.findMany({
    where: { id: { in: photoIds } },
    select: { id: true, dataUrl: true },
    orderBy: { createdAt: 'asc' }
  });
  if (!photos.length) return NextResponse.json({ error: 'Las fotos ya no existen.' }, { status: 404 });

  const element = String(payload.element || 'Losa de azotea no transitable');
  const planta = Number(payload.planta) || 0;
  const userText = `Tipo de área: ${element}${planta ? ` · Área en planta aproximada: ${planta} m²` : ''}\nAnaliza las ${photos.length} foto(s) adjunta(s) del área.`;

  const res: GeminiResult = await askGeminiVision(SYSTEM, photos.map((p) => p.dataUrl), userText, 800);

  if (res.mode !== 'gemini' || !res.text) {
    return NextResponse.json({
      ok: true,
      mode: 'fallback',
      reason: res.reason || 'sin-ia',
      findings: [],
      recommendation:
        'La IA no está disponible en este momento (sin API key o sin conexión). Puedes continuar sin diagnóstico: revisa las partidas previas manualmente y valida en sitio con el supervisor.'
    });
  }

  const { findings, recommendation } = parseFindings(res.text);

  // Guarda la nota de la IA en cada foto analizada (evidencia con contexto).
  await prisma.quotePhoto.updateMany({
    where: { id: { in: photos.map((p) => p.id) } },
    data: { summary: findings.length ? findings.map((f) => `${f.severity}: ${f.title}`).join(' · ') : 'Sin daños visibles' }
  });

  return NextResponse.json({ ok: true, mode: 'gemini', findings, recommendation });
}
