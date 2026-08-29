import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'What My Movies stores, why it stores it, and who else is involved.',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-[var(--muted)]">{children}</div>
    </section>
  )
}

export default function PrivacyPage() {
  return (
    <main>
      <div className="mx-auto max-w-2xl px-6 pt-8 pb-16">
        <h1 className="text-2xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Provisional &mdash; last updated 29 August 2026. This document will be revised as the
          application is completed.
        </p>

        <p className="mt-6 text-sm leading-6 text-[var(--muted)]">
          My Movies is a personal, non-commercial project. It lets you browse a catalogue of
          movies and television shows and keep a private watchlist. This policy describes what
          the application stores about you, why, and which other services are involved.
        </p>

        <Section title="What we store">
          <p>
            <strong className="text-[var(--foreground)]">Account information.</strong> When you
            sign in with GitHub or Google, we receive and store the name, email address, and
            profile picture that provider gives us. We never see or handle your password.
          </p>
          <p>
            <strong className="text-[var(--foreground)]">Sign-in data.</strong> We store the
            tokens your identity provider issues, along with a session identifier. That session
            identifier is also set as a cookie in your browser, which is what keeps you signed in
            between visits.
          </p>
          <p>
            <strong className="text-[var(--foreground)]">Your watchlist.</strong> For each title
            you save, we store its TMDB identifier, whether it is a movie or a television show,
            its title and poster image path, and the date you added it.
          </p>
          <p>
            We do not collect payment details, we show no advertising, and we run no analytics or
            tracking.
          </p>
        </Section>

        <Section title="How we use it">
          <p>
            Account and sign-in data are used only to sign you in and keep you signed in.
            Watchlist data is used only to show you your own watchlist. Nothing is sold, rented,
            or shared for advertising.
          </p>
        </Section>

        <Section title="Services we rely on">
          <p>
            <strong className="text-[var(--foreground)]">GitHub and Google</strong> handle
            sign-in. What they collect when you authenticate is governed by their own privacy
            policies.
          </p>
          <p>
            <strong className="text-[var(--foreground)]">TMDB</strong> supplies all catalogue
            data. Poster and backdrop images are loaded directly from TMDB&rsquo;s image servers
            by your browser, so TMDB receives your IP address and browser details whenever a page
            displays them.
          </p>
          <p>
            <strong className="text-[var(--foreground)]">Neon</strong> hosts the database holding
            everything described above, and{' '}
            <strong className="text-[var(--foreground)]">Vercel</strong> hosts the application
            itself and processes requests to it.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            One essential cookie, holding the session identifier that keeps you signed in. There
            are no analytics, advertising, or third-party tracking cookies.
          </p>
        </Section>

        <Section title="Keeping and deleting your data">
          <p>
            Removing a title from your watchlist deletes that record. To have your account and
            everything associated with it deleted, contact us using the address below.
          </p>
        </Section>

        <Section title="Children">
          <p>This application is not directed at children.</p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            This is a provisional policy for a project still under development. When it changes,
            the date at the top of this page changes with it.
          </p>
        </Section>

        <Section title="Contact">
          <p className="italic">A contact address has not been added to this page yet.</p>
        </Section>
      </div>
    </main>
  )
}
