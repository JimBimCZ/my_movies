import { describe, expect, it } from 'vitest'
import { initialSearchInputState, syncFromUrl, typed } from '@/lib/search-input-state'

describe('typed', () => {
  it('marks pending when the trimmed text differs from the URL', () => {
    const state = typed(initialSearchInputState(''), '', 'matrix')
    expect(state).toEqual({ value: 'matrix', pending: 'matrix' })
  })

  it('clears pending when idle and typing lands back on the current URL query', () => {
    const idle = initialSearchInputState('matrix')
    expect(typed(idle, 'matrix', 'matrix')).toEqual({ value: 'matrix', pending: null })
  })

  it('trims for the pending comparison but keeps the raw text as the visible value', () => {
    const idle = initialSearchInputState('matrix')
    expect(typed(idle, 'matrix', 'matrix ')).toEqual({ value: 'matrix ', pending: null })
  })

  it('keeps guarding when text returns to matching the URL while something is still outstanding', () => {
    // Something is already outstanding (pending "matr"); the URL hasn't
    // caught up to it yet, so it's still "" as far as this render knows.
    const outstanding = { value: 'matr', pending: 'matr' }
    const result = typed(outstanding, '', '')
    // The text now happens to equal the (stale) known URL, but a push is
    // still in flight for "matr" — going idle here would let its late,
    // out-of-order commit slip past the guard.
    expect(result.value).toBe('')
    expect(result.pending).not.toBeNull()
  })
})

describe('syncFromUrl', () => {
  it('adopts an external URL change while idle (no debounce/navigation pending)', () => {
    const idle = initialSearchInputState('')
    expect(syncFromUrl(idle, 'dune')).toEqual({ value: 'dune', pending: null })
  })

  it('clears pending once the URL catches up to what we typed, keeping the typed text as-is', () => {
    const waiting = typed(initialSearchInputState(''), '', 'matrix')
    expect(syncFromUrl(waiting, 'matrix')).toEqual({ value: 'matrix', pending: null })
  })

  it('does not overwrite raw typed text with the trimmed URL value when our own push lands', () => {
    // Trailing whitespace the user typed is not part of the pushed query,
    // but it should survive the resync — this is our own commit landing,
    // not an external change that should replace what's on screen.
    let state = initialSearchInputState('')
    state = typed(state, '', 'star ')
    expect(state.pending).toBe('star')

    const afterOwnCommit = syncFromUrl(state, 'star')
    expect(afterOwnCommit).toEqual({ value: 'star ', pending: null })
  })

  it('ignores a stale, out-of-order commit that does not match the latest keystroke (the clobber)', () => {
    // Typed "matr", debounce fired, its navigation is in flight (slow network).
    let state = typed(initialSearchInputState(''), '', 'matr')
    expect(state.pending).toBe('matr')

    // Before that navigation commits, the user keeps typing to "matrix" — a
    // fresh debounce cycle starts, so `pending` moves to the latest intent.
    state = typed(state, '', 'matrix')
    expect(state.pending).toBe('matrix')

    // The *first* navigation (for "matr") finally lands, out of order. It
    // must not overwrite what the user has since typed.
    const afterStaleCommit = syncFromUrl(state, 'matr')
    expect(afterStaleCommit).toBe(state)
    expect(afterStaleCommit.value).toBe('matrix')

    // The correct navigation (for "matrix") lands next — that one settles.
    const afterRealCommit = syncFromUrl(afterStaleCommit, 'matrix')
    expect(afterRealCommit).toEqual({ value: 'matrix', pending: null })
  })

  it('keeps a deletion that races an earlier, still-unconfirmed push (the clear-during-clobber Critical)', () => {
    // Typed "matr", debounce fired, its navigation is in flight (slow
    // network) — the URL this render still knows about is "".
    let state = typed(initialSearchInputState(''), '', 'matr')
    expect(state.pending).toBe('matr')

    // Before that commits, the user clears the box. The trimmed text now
    // happens to match the (stale) known URL, but the "matr" push is still
    // outstanding — clearing must not read as "we're idle now".
    state = typed(state, '', '')
    expect(state.value).toBe('')
    expect(state.pending).not.toBeNull()

    // The stale "matr" commit lands. It must not refill the box or resume
    // a search the user already cancelled.
    const afterStaleCommit = syncFromUrl(state, 'matr')
    expect(afterStaleCommit.value).toBe('')
    expect(afterStaleCommit.pending).not.toBeNull()

    // Our own clear (pushed for '') eventually lands and settles us to idle.
    const afterOwnCommit = syncFromUrl(afterStaleCommit, '')
    expect(afterOwnCommit).toEqual({ value: '', pending: null })
  })

  it('does not strand a debounce: retyping the same query after an external nav still schedules a push', () => {
    let state = initialSearchInputState('')

    // Typed "alien", it was pushed and confirmed (URL now "alien").
    state = typed(state, '', 'alien')
    state = syncFromUrl(state, 'alien')
    expect(state).toEqual({ value: 'alien', pending: null })

    // Header-link click clears the query out from under the input.
    state = syncFromUrl(state, '')
    expect(state).toEqual({ value: '', pending: null })

    // User retypes "alien" — before its own debounce fires, a Back
    // navigation independently lands on a URL that happens to read "alien"
    // too (coincidence, not our own push confirming).
    state = typed(state, '', 'alien')
    state = syncFromUrl(state, 'alien')
    expect(state).toEqual({ value: 'alien', pending: null })

    // Prove that resync genuinely settled to idle, not just that it shows
    // the right text: a no-op retype of the same query must stay idle too.
    // A mutant that leaves `pending` non-null after the coincidental resync
    // above fails here, not just at the assertion right after that resync.
    state = typed(state, 'alien', 'alien')
    expect(state).toEqual({ value: 'alien', pending: null })

    // The actual reported repro: the next real keystroke must still
    // schedule a push, threaded from the real state above rather than a
    // hard-coded urlQuery — the original "stranded flag" bug lived in the
    // component's effect wiring, not in this pure function, so this line
    // mainly documents that the redesign has no such flag to strand.
    state = typed(state, 'alien', 'aliens')
    expect(state).toEqual({ value: 'aliens', pending: 'aliens' })
  })
})
