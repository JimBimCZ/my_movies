import type { TitleFact } from '@/lib/title-detail'

export function TitleFacts({ facts }: { facts: TitleFact[] }) {
  if (facts.length === 0) return null

  return (
    <dl className="mt-5 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
      {facts.map((fact) => (
        <div key={fact.label} className="flex gap-2">
          <dt className="shrink-0 text-[var(--muted)]">{fact.label}</dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
    </dl>
  )
}
