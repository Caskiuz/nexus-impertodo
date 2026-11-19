import { prisma } from '@/lib/prisma';
import { requireUser, getActiveUnitId } from '@/lib/session';
import CotizarWizard, { type QuoteEditData } from '@/components/CotizarWizard';
import type { SystemDef } from '@/lib/calc';

export default async function CotizarPage({
  searchParams
}: {
  searchParams: Promise<{ area?: string; sys?: string; client?: string; quote?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  let unitId = await getActiveUnitId(user);
  if (!unitId) {
    const first = await prisma.unit.findFirst({ orderBy: { createdAt: 'asc' } });
    unitId = first?.id ?? null;
  }

  const [systemsRaw, clientsRaw, settings, sheets] = await Promise.all([
    prisma.system.findMany({ orderBy: { key: 'asc' } }),
    prisma.client.findMany({ where: { unitId: unitId ?? '__none__' }, orderBy: { name: 'asc' }, include: { assets: true } }),
    prisma.settings.findUnique({ where: { id: 'default' } }),
    prisma.costSheet.findMany({ where: { confirmed: true } })
  ]);

  const systems = systemsRaw as unknown as SystemDef[];
  const clients = clientsRaw.map((c) => ({
    id: c.id,
    name: c.name,
    sector: c.sector,
    contact: c.contact,
    phone: c.phone,
    address: c.address,
    area: c.assets.length ? Math.max(...c.assets.map((a) => a.area || 0)) || null : null
  }));

  // Re-edición de una cotización guardada: se cargan sus datos y el wizard actualiza el mismo folio.
  let quoteData: QuoteEditData | null = null;
  if (params.quote) {
    const q = await prisma.quote.findUnique({
      where: { id: params.quote },
      include: { extras: true, diagnosisPhotos: { orderBy: { createdAt: 'asc' } } }
    });
    if (q && (!unitId || q.unitId === unitId)) {
      quoteData = {
        id: q.id,
        folio: q.folio,
        clientName: q.clientName,
        contact: q.contact || '',
        phone: q.phone || '',
        sector: q.sector,
        element: q.element,
        address: q.address || '',
        billing: q.billing === 'no' ? 'no' : 'si',
        access: q.access,
        moving: q.moving,
        planta: q.planta,
        perim: q.perim,
        alt: q.alt,
        baj: q.baj,
        dom: q.dom,
        duc: q.duc,
        chaflan: q.chaflan,
        extraSections: Array.isArray(q.extraSections) ? (q.extraSections as { p: number; h: number }[]) : [],
        floors: q.floors,
        buildingHeight: q.buildingHeight,
        difficultyNote: q.difficultyNote || '',
        verified: q.verified,
        drainageOk: q.drainageOk,
        diagnosed: q.diagnosed,
        optA: q.optA,
        optB: q.optB,
        selected: q.selected === 'A' ? 'A' : 'B',
        priceMode: q.priceMode,
        marginTarget: q.marginTarget,
        discount: q.discount,
        provider: q.provider,
        extras: q.extras.map((e) => ({
          concept: e.concept,
          unitName: e.unitName,
          qty: e.qty,
          price: e.price,
          costFactor: e.costFactor,
          enabled: e.enabled,
          sourceLabel: e.sourceLabel || undefined
        })),
        photos: q.diagnosisPhotos.map((p) => ({ id: p.id, dataUrl: p.dataUrl }))
      };
    }
  }

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">
            {quoteData ? `Editando cotización ${quoteData.folio}` : 'Cotizador IA · folio nuevo (se asigna al guardar)'}
          </div>
          <h1>Cotizar</h1>
          <div className="sub">
            Cliente → medición → diagnóstico → dos opciones → precio con margen → propuesta. El resumen se actualiza con cada campo y el
            borrador se guarda solo en tu dispositivo mientras capturas.
          </div>
        </div>
        <div className="actions">
          <span className="badge info">Piso de margen {settings?.floor ?? 30}%</span>
          <span className="badge">Indirectos {settings?.indirect ?? 8}%</span>
        </div>
      </div>
      <CotizarWizard
        systems={systems}
        clients={clients}
        floor={settings?.floor ?? 30}
        indirect={settings?.indirect ?? 8}
        documentedKeys={sheets.map((s) => s.systemKey)}
        prefill={{ area: params.area, sys: params.sys, client: params.client }}
        hideMargins={user.role === 'SUPERVISOR'}
        quoteData={quoteData}
      />
    </>
  );
}
