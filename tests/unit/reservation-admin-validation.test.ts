import { describe, expect, it } from 'vitest'
import { ADMIN_PAGE_MAX, ADMIN_SEARCH_MAX, STATUT_RESERVATION_LABELS } from '#shared/config/admin'
import type { StatutReservationDto } from '#shared/types/admin'
import { reservationsQuerySchema, reservationUpdateSchema, statutReservationSchema } from '#shared/validation/reservation'

describe('reservationsQuerySchema', () => {
  it('coerce la page (chaîne) et la borne à 1..ADMIN_PAGE_MAX, défaut 1', () => {
    expect(reservationsQuerySchema.parse({}).page).toBe(1)
    expect(reservationsQuerySchema.parse({ page: '3' }).page).toBe(3)
    expect(reservationsQuerySchema.parse({ page: ADMIN_PAGE_MAX }).page).toBe(ADMIN_PAGE_MAX)
    expect(() => reservationsQuerySchema.parse({ page: 0 })).toThrow()
    expect(() => reservationsQuerySchema.parse({ page: ADMIN_PAGE_MAX + 1 })).toThrow()
    expect(() => reservationsQuerySchema.parse({ page: 'abc' })).toThrow()
    expect(() => reservationsQuerySchema.parse({ page: 1.5 })).toThrow()
  })

  it('trim la recherche, la borne à ADMIN_SEARCH_MAX, vide/blanc → undefined', () => {
    expect(reservationsQuerySchema.parse({ q: '  Awa Diop  ' }).q).toBe('Awa Diop')
    expect(reservationsQuerySchema.parse({ q: '' }).q).toBeUndefined()
    expect(reservationsQuerySchema.parse({ q: '   ' }).q).toBeUndefined()
    expect(() => reservationsQuerySchema.parse({ q: 'a'.repeat(ADMIN_SEARCH_MAX + 1) })).toThrow()
    expect(reservationsQuerySchema.parse({ q: 'a'.repeat(ADMIN_SEARCH_MAX) }).q).toHaveLength(ADMIN_SEARCH_MAX)
  })

  it('valide le statut comme enum stricte', () => {
    for (const statut of ['EN_ATTENTE', 'CONFIRMEE', 'ANNULEE'] as const) {
      expect(reservationsQuerySchema.parse({ statut }).statut).toBe(statut)
    }
    expect(() => reservationsQuerySchema.parse({ statut: 'INVALIDE' })).toThrow()
  })

  it('refuse tout champ inconnu (strict)', () => {
    expect(() => reservationsQuerySchema.parse({ tri: 'date' })).toThrow()
    expect(() => reservationsQuerySchema.parse({ statut: 'EN_ATTENTE', limite: 50 })).toThrow()
  })
})

describe('reservationUpdateSchema', () => {
  it('n’accepte que { statut } avec une valeur de l’enum', () => {
    expect(reservationUpdateSchema.parse({ statut: 'CONFIRMEE' })).toEqual({ statut: 'CONFIRMEE' })
    expect(() => reservationUpdateSchema.parse({ statut: 'X' })).toThrow()
    expect(() => reservationUpdateSchema.parse({})).toThrow()
  })

  it('refuse tout champ inconnu (strict)', () => {
    expect(() => reservationUpdateSchema.parse({ statut: 'CONFIRMEE', note: 'a' })).toThrow()
  })
})

describe('STATUT_RESERVATION_LABELS', () => {
  it('couvre exactement l’enum statutReservationSchema, sans plus', () => {
    expect(new Set(Object.keys(STATUT_RESERVATION_LABELS))).toEqual(new Set(statutReservationSchema.options))
  })

  it('donne un libellé affichable non vide pour chaque statut', () => {
    for (const statut of statutReservationSchema.options as readonly StatutReservationDto[]) {
      const label = STATUT_RESERVATION_LABELS[statut]
      expect(typeof label).toBe('string')
      expect(label.trim().length).toBeGreaterThan(0)
    }
  })
})
