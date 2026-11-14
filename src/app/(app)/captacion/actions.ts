'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser, getActiveUnitId, logAudit } from '@/lib/session';
import { notify } from '@/lib/events';
import { askGemini } from '@/lib/gemini';
import { fmt } from '@/lib/constants';

const RADAR_SEQUENCE_FALLBACK =
  '1) Primer toque: mensaje por WhatsApp/LinkedIn presentando Impertodo y pidiendo fotos del techo · 2) Segundo toque: llamada con rango de precio por m²/año · 3) Tercer toque: visita técnica sin costo con propuesta a reserva de verificar área';

/** Puntaje por reglas fijas cuando no hay API key de IA (costo $0, sin inventar datos). */
function ruleScore(areaM2: number, notes: string): { score: number; analysis: string } {
  let s = 40;
  const señal: string[] = [];
  if (areaM2 >= 5000) { s += 30; señal.push('área muy grande'); }
  else if (areaM2 >= 2000) { s += 20; señal.push('área grande'); }
  else if (areaM2 >= 500) { s += 10; señal.push('área media'); }
  const n = notes.toLowerCase();
  if (/(óxido|oxido|corros|ferrug)/.test(n)) { s += 10; señal.push('óxido visible'); }
  if (/(charco|encharca|fuga|filtrac|gota|humedad)/.test(n)) { s += 12; señal.push('señales de agua'); }
  if (/(linkedin|referencia|recomend|contacto)/.test(n)) { s += 8; señal.push('contacto identificable'); }
  if (/licitac/.test(n)) { s += 5; señal.push('posible licitación'); }
  return {
    score: Math.min(100, s),
    analysis: `Evaluación por reglas fijas (sin IA): ${señal.length ? señal.join(', ') : 'sin señales fuertes en las notas'}. Captura más notas (óxido, charcos, contacto) para afinar el puntaje.`
  };
}

export async function evaluateRadarAction(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get('name') || '').trim();
  const sector = String(formData.get('sector') || 'Comercial');
  const areaM2 = parseFloat(String(formData.get('areaM2') || '0')) || 0;
  const notes = String(formData.get('notes') || '').trim();
  if (!name) redirect('/captacion?err=radar');

  const system =
    'Eres el evaluador de cuentas del radar de techos de Impertodo, empresa de impermeabilización con 45 años en Torreón, Coahuila. ' +
    'Evalúa qué tan buena es una cuenta potencial para atacar primero. Puntaje alto = cuenta grande, techo con daño visible (óxido, charcos, filtraciones) y contacto identificable. ' +
    'Responde EXACTAMENTE en este formato, sin markdown ni encabezados, máximo 100 palabras: ' +
    'PUNTUACION: <número 0-100>\\nANALISIS: <2-3 frases sobre lo que detectas y por qué ese puntaje>\\nSECUENCIA: <3 toques de contacto numerados 1) 2) 3)> ' +
    'Nunca inventes datos que no te dieron.';
  const userText = `Cuenta: ${name}\nSector: ${sector}\nm² aproximados: ${areaM2 || 'sin dato'}\nNotas del levantamiento: ${notes || 'sin notas'}`;

  const res = await askGemini(system, userText, 500);
  let score = 0;
  let analysis = '';
  let sequence = '';

  const scoreMatch = res.text?.match(/PUNTUACION:\s*(\d{1,3})/i);
  const analysisMatch = res.text?.match(/ANALISIS:\s*([\s\S]*?)(?=\n\s*SECUENCIA:|$)/i);
  const sequenceMatch = res.text?.match(/SECUENCIA:\s*([\s\S]*)$/i);

  if (res.mode === 'gemini' && res.text && scoreMatch && analysisMatch) {
    score = Math.max(0, Math.min(100, parseInt(scoreMatch[1], 10)));
    analysis = analysisMatch[1].trim();
    sequence = sequenceMatch ? sequenceMatch[1].trim() : RADAR_SEQUENCE_FALLBACK;
  } else {
    const rules = ruleScore(areaM2, notes);
    score = rules.score;
    analysis = rules.analysis;
    sequence = RADAR_SEQUENCE_FALLBACK;
  }

  await prisma.radarEntry.create({
    data: { name, sector, areaM2: areaM2 || null, notes: notes || null, score, analysis, sequence }
  });
  await logAudit(user, 'Cuenta evaluada en radar de techos', `${name} · score ${score} · ${res.mode === 'gemini' ? 'IA' : 'reglas'}`);
  revalidatePath('/captacion');
  redirect('/captacion?msg=radar');
}

export async function radarToLeadAction(formData: FormData) {
  const user = await requireUser();
  const entryId = String(formData.get('entryId') || '');
  const entry = await prisma.radarEntry.findUnique({ where: { id: entryId } });
  if (!entry) redirect('/captacion?err=radar404');

  const unitId = (await getActiveUnitId(user)) ?? (await prisma.unit.findFirst())?.id;
  if (!unitId) redirect('/captacion');

  await prisma.lead.create({
    data: {
      unitId,
      company: entry.name,
      sector: entry.sector,
      project: 'Radar de techos',
      area: entry.areaM2,
      stage: 0,
      source: 'Radar de techos',
      nextAction: 'Toque 1 de la secuencia',
      heat: entry.score >= 85 ? 'hot' : entry.score >= 70 ? 'warm' : 'cool'
    }
  });
  await logAudit(user, 'Prospecto creado desde radar de techos', `${entry.name} · score ${entry.score}`);
  revalidatePath('/clientes');
  redirect('/captacion?msg=radarlead');
}

export async function estimateLeadAction(formData: FormData) {
  const user = await requireUser();
  const unitId = await getActiveUnitId(user) ?? (await prisma.unit.findFirst())?.id;
  if (!unitId) redirect('/captacion');

  const m2 = parseFloat(String(formData.get('m2') || '0')) || 0;
  const tipo = String(formData.get('tipo') || 'Azotea de casa');
  const phone = String(formData.get('phone') || '');
  const lo = tipo.includes('Nave') ? 199 : 169;
  const hi = tipo.includes('Nave') ? 260 : 390;
  if (m2 <= 0) redirect('/captacion?err=m2');

  await prisma.lead.create({
    data: {
      unitId,
      company: `Lead web · ${tipo}`,
      phone,
      sector: tipo.includes('Nave') ? 'Industrial' : tipo.includes('casa') || tipo.includes('Casa') ? 'Residencial' : 'Comercial',
      project: tipo,
      area: m2,
      amount: m2 * lo,
      stage: 0,
      source: 'Estimador web',
      nextAction: 'Llamar en 10 minutos',
      heat: 'cool'
    }
  });
  await logAudit(user, 'Lead creado desde estimador web', `${m2} m² · ${tipo}`);
  revalidatePath('/captacion');
  revalidatePath('/clientes');
  redirect(`/captacion?msg=lead&lo=${Math.round(m2 * lo)}&hi=${Math.round(m2 * hi)}`);
}

export async function startSequenceAction(formData: FormData) {
  const user = await requireUser();
  const company = String(formData.get('company') || 'Cuenta');
  await notify('Secuencia de 3 toques creada', `Radar de techos: ${company}. El agente preparará contacto (envío manual, sin mensajes automáticos).`, 'SYSTEM');
  await logAudit(user, 'Secuencia de captación creada', company);
  revalidatePath('/captacion');
  redirect('/captacion?msg=secuencia');
}
