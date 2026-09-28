import { describe, expect, it } from 'vitest'
import { instantQuebec, jourIsoSemaine } from '#shared/utils/dates'

describe('instantQuebec', () => {
  it('should convert a summer wall-clock time (UTC-4) to UTC', () => {
    expect(instantQuebec('2026-07-14', '19:30').toISOString()).toBe('2026-07-14T23:30:00.000Z')
  })

  it('should convert a winter wall-clock time (UTC-5) to UTC, crossing midnight', () => {
    expect(instantQuebec('2026-12-14', '19:30').toISOString()).toBe('2026-12-15T00:30:00.000Z')
  })

  it('should be correct the day before and the day after a DST change', () => {
    // Passage à l'heure d'été 2026 : 2026-03-08 (UTC-5 -> UTC-4).
    expect(instantQuebec('2026-03-07', '12:00').toISOString()).toBe('2026-03-07T17:00:00.000Z')
    expect(instantQuebec('2026-03-09', '12:00').toISOString()).toBe('2026-03-09T16:00:00.000Z')
    // Retour à l'heure normale 2026 : 2026-11-01 (UTC-4 -> UTC-5).
    expect(instantQuebec('2026-10-31', '12:00').toISOString()).toBe('2026-10-31T16:00:00.000Z')
    expect(instantQuebec('2026-11-02', '12:00').toISOString()).toBe('2026-11-02T17:00:00.000Z')
  })
})

describe('jourIsoSemaine', () => {
  it('should return 7 for a Sunday', () => {
    expect(jourIsoSemaine('2026-09-27')).toBe(7)
  })

  it('should return 1 for a Monday', () => {
    expect(jourIsoSemaine('2026-09-28')).toBe(1)
  })
})
