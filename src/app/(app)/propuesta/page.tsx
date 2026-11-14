import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireUser, getActiveUnitId } from '@/lib/session';
import ProposalView from '@/components/ProposalView';
import ModuleExplainer from '@/components/ModuleExplainer';
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
        <div className="actions">
          {selected && (
            <Link className="btn sm" href={`/cotizar?quote=${selected.id}`}>
              ✎ Editar cotización {selected.folio}
            </Link>
          )}
        </div>
      </div>

      <ModuleExplainer
        points={[
          'Es el enlace interactivo que le mandas al cliente por WhatsApp: la cotización se ve como una tarjeta en su celular, no como un PDF plano.',
          'El cliente ve las dos opciones (la económica y la recomendada) con el precio total y el costo por m² por año, y elige o aprueba desde su teléfono.',
          'Cada vez que abre el enlace queda registrado aquí: sabes quién está viendo tu propuesta y cuándo, sin tener que preguntarle.',
          'Al aprobar, el prospecto avanza de etapa y la cotización queda lista para la autorización interna en Aprobaciones, que genera la obra.',
          'También imprime la propuesta oficial firmada en PDF para el cliente que prefiere papel.',
          'Te sirve si: quieres que el cliente decida rápido y saber si ya vio la cotización antes de marcarle de nuevo.'
        ]}
      />

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
