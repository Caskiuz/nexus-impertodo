import { prisma } from '@/lib/prisma';
import ProposalView from '@/components/ProposalView';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function PublicProposalPage({
  params,
  searchParams
}: {
  params: Promise<{ folio: string }>;
  searchParams: Promise<{ msg?: string }>;
}) {
  const { folio } = await params;
  const sp = await searchParams;
  const quote = await prisma.quote.findFirst({ where: { folio } });
  if (quote) {
    await prisma.quoteEvent.create({
      data: { quoteId: quote.id, type: 'OPEN', detail: 'Apertura del enlace público de la propuesta' }
    });
  }

  return (
    <div style={{ maxWidth: 1060, margin: '0 auto', padding: '26px 18px 60px' }}>
      <div className="head no-print">
        <div>
          <div className="eyebrow">Vista del cliente · propuesta viva</div>
          <h1>Propuesta {folio}</h1>
          <div className="sub">Compara las opciones, elige y aprueba. Sin cobro en línea: el anticipo se coordina con tu asesor.</div>
        </div>
        <div className="actions">
          <Link className="btn sm" href="/login">
            Acceso Impertodo
          </Link>
        </div>
      </div>
      {sp.msg === 'elegida' && <div className="alert g no-print">Opción registrada. Tu asesor ya lo sabe.</div>}
      {sp.msg === 'aprobada' && (
        <div className="alert g no-print">
          ¡Propuesta aprobada! Se notificó a Impertodo. Te contactamos para confirmar visita y anticipo.
        </div>
      )}
      <ProposalView folio={folio} mode="public" />
    </div>
  );
}
