'use server'
import { signIn, signOut } from '@/server/auth/config'

export async function signInWithProvider(
  provider: 'github' | 'google',
  callbackUrl: string,
): Promise<void> {
  await signIn(provider, { redirectTo: callbackUrl })
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: '/' })
}
