import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireUser, getActiveUnitId, visibleUnits } from '@/lib/session';
import AppShell from '@/components/AppShell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [units, activeUnitId] = await Promise.all([visibleUnits(user), getActiveUnitId(user)]);

  const scope = activeUnitId ? { unitId: activeUnitId } : {};
  const [unread, pendingQuotes, pendingDocs] = await Promise.all([
    prisma.notification.count({ where: { read: false } }),
    prisma.quote.count({ where: { ...scope, status: { in: ['BORRADOR', 'ENVIADA'] } } }),
    prisma.doc.count({ where: { ...scope, status: { in: ['PENDIENTE', 'REVISADO'] } } })
  ]);

  if (!units.length) redirect('/login');

  return (
    <AppShell
      user={{ name: user.name, email: user.email, role: user.role }}
      units={units.map((u) => ({ id: u.id, name: u.name, kind: u.kind }))}
      activeUnitId={activeUnitId}
      unread={unread}
      pendingApprovals={pendingQuotes + pendingDocs}
    >
      {children}
    </AppShell>
  );
}
