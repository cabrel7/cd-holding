import { describe, expect, it } from 'vitest'
import { formatDateISO, formatMoisAnnee, isDateISOValide } from '#shared/utils/dates'

describe('formatMoisAnnee', () => {
  it('should format a UTC midnight date string as "juin 2022", not "mai 2022"', () => {
    // Piège classique : new Date('2022-06-01') est minuit UTC. Dans un fuseau négatif
    // (ex. America/Montreal, UTC-4/-5), un formatage NON-UTC affiche "mai 2022".
    expect(formatMoisAnnee('2022-06-01')).toBe('juin 2022')
  })

  it('should format a Date instance the same way', () => {
    expect(formatMoisAnnee(new Date('2022-06-01T00:00:00.000Z'))).toBe('juin 2022')
  })

  it('should format the last day of the month without rolling over', () => {
    expect(formatMoisAnnee('2023-12-31')).toBe('décembre 2023')
  })
})

describe('formatDateISO', () => {
  it('should format a Date to YYYY-MM-DD in UTC', () => {
    expect(formatDateISO(new Date('2024-01-15T00:00:00.000Z'))).toBe('2024-01-15')
  })

  it('should return null for a null or undefined input', () => {
    expect(formatDateISO(null)).toBeNull()
    expect(formatDateISO(undefined)).toBeNull()
  })
})

describe('isDateISOValide', () => {
  it('should accept a well-formed date', () => {
    expect(isDateISOValide('2024-01-15')).toBe(true)
  })

  it('should reject a malformed date', () => {
    expect(isDateISOValide('15-01-2024')).toBe(false)
    expect(isDateISOValide('2024-13-40')).toBe(false)
  })
})
