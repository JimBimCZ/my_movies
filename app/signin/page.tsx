import type { Metadata } from 'next'
import { safeCallbackUrl } from '@/lib/callback-url'
import { signInWithProvider } from '@/server/auth/actions'

export const metadata: Metadata = { title: 'Sign in' }

const ERRORS: Record<string, string> = {
  OAuthAccountNotLinked:
    'That email address is already registered with a different sign-in provider. Use the one you signed in with the first time.',
  AccessDenied: 'That account is not permitted to sign in.',
}

export default async function SignInPage({ searchParams }: PageProps<'/signin'>) {
  const { callbackUrl: rawCallback, error: rawError } = await searchParams
  const callbackUrl = safeCallbackUrl(rawCallback)
  const errorKey = Array.isArray(rawError) ? rawError[0] : rawError
  const message = errorKey ? (ERRORS[errorKey] ?? 'Sign-in failed. Please try again.') : null

  const withGitHub = signInWithProvider.bind(null, 'github', callbackUrl)
  const withGoogle = signInWithProvider.bind(null, 'google', callbackUrl)

  return (
    <main>
      <div className="mx-auto max-w-sm px-6 py-16">
        <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Sign in to keep a watchlist. We store only what your provider tells us: your name,
          email address, and avatar.
        </p>

        {message ? (
          <p role="alert" className="mt-6 rounded-md bg-red-500/10 p-3 text-sm text-red-200">
            {message}
          </p>
        ) : null}

        <div className="mt-8 flex flex-col gap-3">
          <form action={withGitHub}>
            <button
              type="submit"
              className="w-full rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Continue with GitHub
            </button>
          </form>
          <form action={withGoogle}>
            <button
              type="submit"
              className="w-full rounded-md border border-white/20 px-4 py-2.5 text-sm font-semibold hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Continue with Google
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
