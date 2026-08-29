// Mirrors SearchInput's own wrapper, label and control box so the box does not move when the
// real input replaces it: mt-8/max-w-2xl/px-6 from the label, then the caption and the
// px-4 py-3 text-lg control, which measures 54px tall.
export function SearchInputSkeleton() {
  return (
    <div className="mx-auto mt-8 block max-w-2xl px-6">
      <div className="mb-2 h-5 w-40 animate-pulse rounded bg-white/5" />
      <div className="h-[54px] w-full animate-pulse rounded-md border border-white/15 bg-white/5" />
    </div>
  )
}
