import { prisma } from '@/lib/prisma';
import { requireUser, getActiveUnitId } from '@/lib/session';
import CotizarWizard from '@/components/CotizarWizard';
import type { SystemDef } from '@/lib/calc';

export default async function CotizarPage({
  searchParams
}: {
  searchParams: Promise<{ area?: string; sys?: string; client?: string }>;
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

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">Cotizador IA · folio nuevo (se asigna al guardar)</div>
          <h1>Cotizar</h1>
          <div className="sub">
            Cliente → medición → diagnóstico → dos opciones → precio con margen → propuesta. El resumen se actualiza con cada campo.
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
      />
    </>
  );
}
