'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser, logAudit } from '@/lib/session';

export async function markNotificationReadAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get('id') || '');
  await prisma.notification.update({ where: { id }, data: { read: true } }).catch(() => null);
  revalidatePath('/notificaciones');
  revalidatePath('/', 'layout');
}

export async function markAllNotificationsReadAction() {
  const user = await requireUser();
  await prisma.notification.updateMany({ data: { read: true } });
  await logAudit(user, 'Bandeja de notificaciones marcada como leída');
  revalidatePath('/notificaciones');
  revalidatePath('/', 'layout');
}
