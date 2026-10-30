'use server';

import { AuthError } from 'next-auth';
import { signIn, signOut } from '@/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export async function loginAction(formData: FormData) {
  try {
    await signIn('credentials', {
      email: String(formData.get('email') || ''),
      password: String(formData.get('password') || ''),
      redirectTo: '/hoy'
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect('/login?error=1');
    }
    throw error;
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: '/login' });
}

export async function setActiveUnit(formData: FormData) {
  const id = String(formData.get('unit') || '');
  const store = await cookies();
  if (id) {
    store.set('unit', id, { path: '/', maxAge: 60 * 60 * 24 * 30 });
  } else {
    store.delete('unit');
  }
  revalidatePath('/', 'layout');
}
