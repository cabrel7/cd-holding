import { describe, expect, it } from 'vitest'
import {
  creneauxPourDate,
  libelleJoursOuverture,
  reglagesValides,
  type ReglagesReservation,
} from '#shared/utils/restaurant'
import { reservationBaseSchema, reservationSchema } from '#shared/validation/reservation'

const REGLAGES: ReglagesReservation = {
  joursOuverture: [2, 3, 4, 5, 6, 7], // mardi à dimanche : fermé le lundi
  heureOuverture: '11:00',
  heureFermeture: '22:00',
  dernierService: '20:30',
  pasCreneauMinutes: 30,
  capaciteMaxReservation: 8,
  delaiMinimumHeures: 2,
  horizonJours: 30,
}

const VALEURS_BASE = {
  nom: 'Jean Tremblay',
  email: 'jean@exemple.ca',
  telephone: '514-555-0123',
  nombrePersonnes: 2,
}

describe('reglagesValides', () => {
  it.each([[[0, 1]], [[1, 8]], [[1, 1, 2]], [[1.5]], [[-1]]])('should reject joursOuverture %j', (jours) => {
    expect(reglagesValides({ ...REGLAGES, joursOuverture: jours })).toBe(false)
  })

  it('should accept unique ISO days 1..7', () => {
    expect(reglagesValides({ ...REGLAGES, joursOuverture: [1, 7] })).toBe(true)
  })

  it('should reject a step of 0 minutes (infinite loop guard)', () => {
    expect(reglagesValides({ ...REGLAGES, pasCreneauMinutes: 0 })).toBe(false)
  })
})

describe('creneauxPourDate', () => {
  it('should return no slots on a closed Monday', () => {
    // 2026-09-28 est un lundi.
    expect(creneauxPourDate(REGLAGES, '2026-09-28', new Date('2026-09-20T12:00:00Z'))).toEqual([])
  })

  it('should return the first slot at 20:30 for today at 18:05 with a 2h minimum delay', () => {
    // 2026-09-29 est un mardi (ouvert). "Maintenant" = 18:05 heure Québec (UTC-4, heure d'été).
    const maintenant = new Date('2026-09-29T22:05:00Z')
    const creneaux = creneauxPourDate(REGLAGES, '2026-09-29', maintenant)
    expect(creneaux[0]).toBe('20:30')
  })

  it('should return no slots beyond the horizon', () => {
    const maintenant = new Date('2026-09-20T12:00:00Z')
    expect(creneauxPourDate(REGLAGES, '2026-12-01', maintenant)).toEqual([])
  })

  it('should never loop infinitely when the step is 0 (invalid settings)', () => {
    expect(creneauxPourDate({ ...REGLAGES, pasCreneauMinutes: 0 }, '2026-09-29', new Date('2026-09-20T12:00:00Z'))).toEqual([])
  })
})

describe('libelleJoursOuverture', () => {
  it('should format a contiguous range', () => {
    expect(libelleJoursOuverture([2, 3, 4, 5, 6, 7])).toBe('Mardi — dimanche')
  })

  it('should format a non-contiguous list', () => {
    expect(libelleJoursOuverture([2, 4, 6])).toBe('Mardi, jeudi, samedi')
  })
})

describe('reservationSchema', () => {
  it('should reject a reservation on a closed Monday', () => {
    const schema = reservationSchema(REGLAGES, () => new Date('2026-09-20T12:00:00Z'))
    const result = schema.safeParse({ ...VALEURS_BASE, date: '2026-09-28', heure: '19:00' })
    expect(result.success).toBe(false)
  })

  it('should reject a past date', () => {
    const schema = reservationSchema(REGLAGES, () => new Date('2026-09-29T12:00:00Z'))
    const result = schema.safeParse({ ...VALEURS_BASE, date: '2026-09-01', heure: '19:00' })
    expect(result.success).toBe(false)
  })

  it('should reject more people than the per-reservation cap', () => {
    const schema = reservationSchema(REGLAGES, () => new Date('2026-09-20T12:00:00Z'))
    const result = schema.safeParse({ ...VALEURS_BASE, date: '2026-09-29', heure: '19:00', nombrePersonnes: 9 })
    expect(result.success).toBe(false)
  })

  it('should reject an hour outside the available slots', () => {
    const schema = reservationSchema(REGLAGES, () => new Date('2026-09-20T12:00:00Z'))
    const result = schema.safeParse({ ...VALEURS_BASE, date: '2026-09-29', heure: '19:07' })
    expect(result.success).toBe(false)
  })

  it('should accept a valid reservation', () => {
    const schema = reservationSchema(REGLAGES, () => new Date('2026-09-20T12:00:00Z'))
    const result = schema.safeParse({ ...VALEURS_BASE, date: '2026-09-29', heure: '19:00' })
    expect(result.success).toBe(true)
  })
})

describe('reservationBaseSchema', () => {
  it('should reject unknown keys (strict)', () => {
    const result = reservationBaseSchema.safeParse({ ...VALEURS_BASE, date: '2026-09-29', heure: '19:00', extra: 'x' })
    expect(result.success).toBe(false)
  })
})
