import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireUser, getActiveUnitId } from '@/lib/session';
import ProposalView from '@/components/ProposalView';
import { fmt } from '@/lib/constants';

export default async function PropuestaPage({ searchParams }: { searchParams: Promise<{ folio?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const unitId = await getActiveUnitId(user);
  const scope = unitId ? { unitId } : {};

  const quotes = await prisma.quote.findMany({ where: scope, orderBy: { createdAt: 'desc' }, take: 12 });
  const selected = sp.folio ? quotes.find((q) => q.folio === sp.folio) || quotes[0] : quotes[0];

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">Vista del cliente · enlace</div>
          <h1>Propuesta viva</h1>
          <div className="sub">El cliente la abre en su celular, compara opciones, elige y aprueba. Cada apertura se registra.</div>
        </div>
      </div>

      {quotes.length === 0 ? (
        <div className="alert y">
          Aún no hay propuestas. <Link href="/cotizar">Crea una cotización</Link> para generar el enlace público.
        </div>
      ) : (
        <>
          <div className="tabs">
            {quotes.map((q) => (
              <Link key={q.id} className={`tab ${selected?.folio === q.folio ? 'on' : ''}`} href={`/propuesta?folio=${q.folio}`}>
                {q.folio} · {q.clientName.split(' ').slice(0, 3).join(' ')} · {fmt(q.total)}
              </Link>
            ))}
          </div>
          {selected && <ProposalView folio={selected.folio} mode="internal" />}
        </>
      )}
    </>
  );
}
