import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  unitId: string | null;
}

export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return {
    id: session.user.id,
    name: session.user.name || '',
    email: session.user.email || '',
    role: session.user.role,
    unitId: session.user.unitId ?? null
  };
}

export function isCentralLike(role: string): boolean {
  return role === 'CENTRAL' || role === 'DEV' || role === 'GERENCIA';
}

/** Unit selected for viewing. Central-like users can switch via cookie; others fixed. */
export async function getActiveUnitId(user: SessionUser): Promise<string | null> {
  if (isCentralLike(user.role)) {
    const store = await cookies();
    const selected = store.get('unit')?.value;
    if (selected) {
      const unit = await prisma.unit.findUnique({ where: { id: selected } });
      if (unit) return unit.id;
    }
    return null; // all units
  }
  return user.unitId;
}

/** Returns the units list visible to the user. */
export async function visibleUnits(user: SessionUser) {
  if (isCentralLike(user.role)) {
    return prisma.unit.findMany({ orderBy: { createdAt: 'asc' } });
  }
  return prisma.unit.findMany({ where: { id: user.unitId ?? '__none__' } });
}

/** Unit filter for queries: null means all units (central view). */
export async function activeUnitFilter(user: SessionUser): Promise<string | null> {
  return getActiveUnitId(user);
}

export async function logAudit(user: SessionUser | null, action: string, ref?: string) {
  await prisma.auditLog.create({
    data: { userId: user?.id, userName: user?.name, role: user?.role, action, ref: ref ?? null }
  });
}
