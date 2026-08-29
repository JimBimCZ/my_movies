// Mirrors Hero: same section box, same gradient, and blocks standing in for the h1, the
// three-line clamped overview and the call to action, all at the same offsets. A bare
// rectangle here let the text and button appear from nothing when the hero resolved.
export function HeroSkeleton() {
  return (
    <section className="relative mb-8 h-[60vh] min-h-[380px] w-full">
      <div className="absolute inset-0 animate-pulse bg-white/5" />
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/40 to-transparent" />
      <div className="absolute bottom-10 left-6 max-w-xl">
        <div className="h-10 w-80 max-w-full animate-pulse rounded bg-white/10" />
        <div className="mt-3 space-y-3">
          <div className="h-4 w-full animate-pulse rounded bg-white/5" />
          <div className="h-4 w-full animate-pulse rounded bg-white/5" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-white/5" />
        </div>
        <div className="mt-5 h-10 w-28 animate-pulse rounded bg-white/10" />
      </div>
    </section>
  )
}
