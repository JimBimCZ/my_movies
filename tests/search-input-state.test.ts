import { describe, expect, it } from 'vitest'
import { initialSearchInputState, syncFromUrl, typed } from '@/lib/search-input-state'

describe('typed', () => {
  it('marks pending when the trimmed text differs from the URL', () => {
    expect(typed('', 'matrix')).toEqual({ value: 'matrix', pending: 'matrix' })
  })

  it('clears pending when typing lands back on the current URL query', () => {
    expect(typed('matrix', 'matrix')).toEqual({ value: 'matrix', pending: null })
  })

  it('trims for the pending comparison but keeps the raw text as the visible value', () => {
    expect(typed('matrix', 'matrix ')).toEqual({ value: 'matrix ', pending: null })
  })
})

describe('syncFromUrl', () => {
  it('adopts an external URL change while idle (no debounce/navigation pending)', () => {
    const idle = initialSearchInputState('')
    expect(syncFromUrl(idle, 'dune')).toEqual({ value: 'dune', pending: null })
  })

  it('clears pending once the URL catches up to what we typed', () => {
    const waiting = typed('', 'matrix')
    expect(syncFromUrl(waiting, 'matrix')).toEqual({ value: 'matrix', pending: null })
  })

  it('ignores a stale, out-of-order commit that does not match the latest keystroke (the clobber)', () => {
    // Typed "matr", debounce fired, its navigation is in flight (slow network).
    let state = typed('', 'matr')
    expect(state.pending).toBe('matr')

    // Before that navigation commits, the user keeps typing to "matrix" — a
    // fresh debounce cycle starts, so `pending` moves to the latest intent.
    state = typed('', 'matrix')
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

  it('does not strand a debounce: retyping the same query after an external nav still schedules a push', () => {
    // Typed "alien", it was pushed and confirmed (URL now "alien").
    let state = typed('', 'alien')
    state = syncFromUrl(state, 'alien')
    expect(state).toEqual({ value: 'alien', pending: null })

    // Header-link click clears the query out from under the input.
    state = syncFromUrl(state, '')
    expect(state).toEqual({ value: '', pending: null })

    // User retypes "alien" — before its own debounce fires, a Back
    // navigation independently lands on a URL that happens to read "alien"
    // too (coincidence, not our own push confirming).
    state = typed('', 'alien')
    state = syncFromUrl(state, 'alien')
    expect(state).toEqual({ value: 'alien', pending: null })

    // The next real keystroke must still schedule a push — this is the
    // "stranded flag eats a keystroke" regression: pending must not stay
    // stuck at null forever after the coincidental resync above.
    state = typed('alien', 'aliens')
    expect(state).toEqual({ value: 'aliens', pending: 'aliens' })
  })
})
