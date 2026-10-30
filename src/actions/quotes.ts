'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireUser, logAudit } from '@/lib/session';
import { computeQuote, type QuoteInput, type ExtraInput, type SystemDef } from '@/lib/calc';
import { recordBusinessEvent } from '@/lib/events';

const ExtraSchema = z.object({
  concept: z.string().min(1),
  unitName: z.string().default('m²'),
  qty: z.number().nonnegative(),
  price: z.number().nonnegative(),
  costFactor: z.number().min(0).max(1).default(0.68),
  enabled: z.boolean().default(true),
  sourceLabel: z.string().optional()
});

const QuoteSchema = z.object({
  id: z.string().optional(),
  clientName: z.string().min(1, 'Cliente requerido'),
  contact: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  sector: z.string().default('Comercial'),
  element: z.string().default('Losa de azotea no transitable'),
  address: z.string().optional().default(''),
  billing: z.enum(['si', 'no']).default('si'),
  access: z.string().default('1'),
  moving: z.number().default(0),
  planta: z.number().nonnegative(),
  perim: z.number().nonnegative(),
  alt: z.number().nonnegative(),
  baj: z.number().nonnegative(),
  dom: z.number().nonnegative(),
  duc: z.number().nonnegative(),
  verified: z.boolean().default(false),
  drainageOk: z.boolean().default(true),
  diagnosed: z.boolean().default(false),
  optA: z.string(),
  optB: z.string(),
  selected: z.enum(['A', 'B']),
  priceMode: z.string().default('promo'),
  marginTarget: z.number().default(32),
  discount: z.number().min(0).max(95).default(0),
  provider: z.string().default('nac'),
  extras: z.array(ExtraSchema).default([]),
  send: z.boolean().default(false)
});

export type QuotePayload = z.input<typeof QuoteSchema>;

export async function saveQuoteAction(payload: QuotePayload): Promise<{ ok: boolean; id?: string; folio?: string; error?: string }> {
  const user = await requireUser();
  const parsed = QuoteSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' };
  }
  const data = parsed.data;

  const systems = await prisma.system.findMany();
  const selectedKey = data.selected === 'A' ? data.optA : data.optB;
  const sys = systems.find((s) => s.key === selectedKey);
  if (!sys) return { ok: false, error: 'Sistema de catálogo inválido' };

  const settings = await prisma.settings.findUnique({ where: { id: 'default' } });
  const floor = settings?.floor ?? 30;
  const indirect = settings?.indirect ?? 8;

  const input: QuoteInput = {
    planta: data.planta,
    perim: data.perim,
    alt: data.alt,
    baj: data.baj,
    dom: data.dom,
    duc: data.duc,
    optA: data.optA,
    optB: data.optB,
    selected: data.selected,
    priceMode: data.priceMode,
    marginTarget: data.marginTarget,
    discount: data.discount,
    floor,
    indirect,
    provider: data.provider,
    access: data.access,
    moving: data.moving,
    billing: data.billing === 'si',
    extras: data.extras as ExtraInput[]
  };

  const c = computeQuote(sys as unknown as SystemDef, input);

  let unitId = user.unitId;
  if (!unitId) {
    const first = await prisma.unit.findFirst({ orderBy: { createdAt: 'asc' } });
    unitId = first?.id ?? null;
  }
  if (!unitId) return { ok: false, error: 'Sin unidad activa' };

  const sheet = await prisma.costSheet.findUnique({ where: { systemKey: sys.key } });
  const documented = Boolean(sheet?.confirmed);

  let folio: string;
  let quoteId = data.id;
  if (quoteId) {
    const existing = await prisma.quote.findUnique({ where: { id: quoteId } });
    if (!existing || existing.unitId !== unitId) return { ok: false, error: 'Cotización no encontrada' };
    folio = existing.folio;
  } else {
    const last = await prisma.quote.findFirst({ where: { unitId }, orderBy: { createdAt: 'desc' } });
    const lastNum = last ? parseInt(last.folio.split('-')[1] || '0', 10) : 40;
    folio = `${new Date().getFullYear()}-${String((Number.isFinite(lastNum) ? lastNum : 40) + 1).padStart(3, '0')}`;
  }

  const quote = await prisma.$transaction(async (tx) => {
    const common = {
      clientName: data.clientName,
      contact: data.contact,
      phone: data.phone,
      sector: data.sector,
      element: data.element,
      address: data.address,
      billing: data.billing,
      access: data.access,
      moving: data.moving,
      planta: data.planta,
      perim: data.perim,
      alt: data.alt,
      baj: data.baj,
      dom: data.dom,
      duc: data.duc,
      verified: data.verified,
      drainageOk: data.drainageOk,
      diagnosed: data.diagnosed,
      optA: data.optA,
      optB: data.optB,
      selected: data.selected,
      priceMode: data.priceMode,
      marginTarget: data.marginTarget,
      discount: data.discount,
      provider: data.provider,
      floor,
      indirect,
      areaDev: c.area.dev,
      sub: c.sub,
      iva: c.iva,
      total: c.total,
      margin: c.margin,
      costsDocumented: documented,
      catalogSource: documented ? sheet?.source : null,
      status: data.send ? 'ENVIADA' : 'BORRADOR'
    };

    if (quoteId) {
      await tx.quoteExtra.deleteMany({ where: { quoteId } });
      return tx.quote.update({
        where: { id: quoteId },
        data: {
          ...common,
          extras: {
            create: data.extras.map((e) => ({
              concept: e.concept,
              unitName: e.unitName,
              qty: e.qty,
              price: e.price,
              costFactor: e.costFactor,
              enabled: e.enabled,
              sourceLabel: e.sourceLabel
            }))
          }
        }
      });
    }

    return tx.quote.create({
      data: {
        ...common,
        folio,
        unitId,
        extras: {
          create: data.extras.map((e) => ({
            concept: e.concept,
            unitName: e.unitName,
            qty: e.qty,
            price: e.price,
            costFactor: e.costFactor,
            enabled: e.enabled,
            sourceLabel: e.sourceLabel
          }))
        }
      }
    });
  });

  await prisma.quoteEvent.create({
    data: { quoteId: quote.id, type: data.send ? 'SENT' : 'CREATED', detail: data.send ? 'Enviada por WhatsApp (demo)' : 'Borrador guardado' }
  });

  if (data.send) {
    const lead = await prisma.lead.findFirst({ where: { unitId, company: data.clientName } });
    if (lead && lead.stage < 2) {
      await prisma.lead.update({ where: { id: lead.id }, data: { stage: 2, daysInStage: 0, amount: c.total } });
    }
  }

  await logAudit(user, data.send ? 'Cotización enviada' : 'Cotización guardada', quote.folio);
  revalidatePath('/cotizar');
  revalidatePath('/aprobaciones');
  revalidatePath('/hoy');
  revalidatePath('/propuesta');
  revalidatePath('/clientes');

  return { ok: true, id: quote.id, folio: quote.folio };
}

export async function approveQuoteAction(formData: FormData) {
  const user = await requireUser();
  const quoteId = String(formData.get('quoteId') || '');
  const redirectTo = String(formData.get('redirectTo') || '/aprobaciones');
  const q = await prisma.quote.findUnique({ where: { id: quoteId } });
  if (!q) redirect(`${redirectTo}?err=noexiste`);

  const canAdmin = ['ADMIN', 'CENTRAL', 'DEV'].includes(user.role);
  const canGerencia = ['GERENCIA', 'CENTRAL', 'DEV'].includes(user.role);

  if (!canAdmin && !canGerencia) redirect(`${redirectTo}?err=rol`);
  if (!q.costsDocumented) redirect(`${redirectTo}?err=costos`);

  if (canAdmin && !q.approvalsAdmin) {
    await prisma.quote.update({ where: { id: q.id }, data: { approvalsAdmin: true } });
    await logAudit(user, 'Revisión de cotización por Administración', q.folio);
    revalidatePath(redirectTo);
    redirect(`${redirectTo}?msg=admin-ok`);
  }

  if (canGerencia) {
    if (!q.approvalsAdmin) redirect(`${redirectTo}?err=admin-primero`);
    if (q.margin * 100 < q.floor) {
      await logAudit(user, 'Autorización especial: margen bajo piso', `${q.folio} · ${(q.margin * 100).toFixed(1)}%`);
    }
    await prisma.quote.update({ where: { id: q.id }, data: { approvalsGerencia: true, status: 'APROBADA' } });

    const sys = await prisma.system.findUnique({ where: { key: q.selected === 'A' ? q.optA : q.optB } });
    const phases = sys?.unit === 'L' ? 6 : sys?.unit === 'm2' ? 7 : 4;
    const packs = sys ? Math.ceil((q.areaDev * sys.cons * (1 + sys.waste)) / sys.pack) : 0;
    const otCount = await prisma.oT.count();
    const code = `OT-2026-${String(90 + otCount).padStart(3, '0')}`;
    await prisma.oT.create({
      data: {
        code,
        unitId: q.unitId,
        quoteId: q.id,
        clientName: q.clientName,
        systemKey: sys?.key || 'acr10',
        area: Math.round(q.areaDev),
        supervisor: 'J. Ramírez',
        crew: 3,
        status: 'POR_INICIAR',
        phases,
        matTheo: packs
      }
    });

    const lead = await prisma.lead.findFirst({ where: { unitId: q.unitId, company: q.clientName } });
    if (lead) await prisma.lead.update({ where: { id: lead.id }, data: { stage: 4, daysInStage: 0, heat: 'cool' } });

    await recordBusinessEvent({
      type: 'QUOTE_APPROVED',
      title: `Cotización aprobada · ${q.folio}`,
      description: `${q.clientName} · ${fmtMoney(q.total)} · se generó ${code} y se reservaron materiales.`,
      amount: 0,
      unitId: q.unitId,
      sourceId: q.id
    });

    await logAudit(user, 'Cotización aprobada por Gerencia', `${q.folio} → ${code}`);
    revalidatePath('/aprobaciones');
    revalidatePath('/obra');
    revalidatePath('/hoy');
    redirect(`${redirectTo}?msg=aprobada`);
  }

  revalidatePath(redirectTo);
}

function fmtMoney(n: number) {
  return '$' + Math.round(n || 0).toLocaleString('es-MX');
}
