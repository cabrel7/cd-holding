import { describe, expect, it } from 'vitest'
import { construireReservation, recapitulatifReservation, toRestaurantDto, type ReglagesRow } from '../../server/lib/reservation'
import type { ReservationBody } from '#shared/validation/reservation'

const body: ReservationBody = {
  nom: 'Awa Diop',
  email: 'awa@exemple.ca',
  telephone: '514-000-0000',
  date: '2026-10-14',
  heure: '19:30',
  nombrePersonnes: 4,
}

describe('construireReservation', () => {
  it('maps the validated body plus the resolved company and UTC instant', () => {
    const dateReservation = new Date('2026-10-14T23:30:00.000Z')
    const data = construireReservation(body, 5, dateReservation)
    expect(data).toEqual({
      companyId: 5,
      nom: 'Awa Diop',
      email: 'awa@exemple.ca',
      telephone: '514-000-0000',
      nombrePersonnes: 4,
      dateReservation,
      notes: null,
    })
  })

  it('keeps notes when provided', () => {
    const data = construireReservation({ ...body, notes: 'Allergie aux arachides' }, 5, new Date('2026-10-14T23:30:00.000Z'))
    expect(data.notes).toBe('Allergie aux arachides')
  })
})

describe('recapitulatifReservation', () => {
  it('formats "N personnes, <jour> <date> à <heure>" using Quebec local time (EDT, summer)', () => {
    const dateReservation = new Date('2026-10-14T23:30:00.000Z') // 19h30 EDT (UTC-4)
    expect(recapitulatifReservation(body, dateReservation)).toBe('4 personnes, mercredi 14 octobre 2026 à 19h30')
  })

  it('uses the singular for a single person', () => {
    const dateReservation = new Date('2026-10-14T23:30:00.000Z')
    expect(recapitulatifReservation({ ...body, nombrePersonnes: 1 }, dateReservation)).toContain('1 personne,')
  })

  it('never promises a confirmation "within the hour" or any timing not in the text', () => {
    const dateReservation = new Date('2026-10-14T23:30:00.000Z')
    const recap = recapitulatifReservation(body, dateReservation)
    expect(recap).not.toMatch(/heure|confirm/i)
  })
})

describe('toRestaurantDto', () => {
  it('maps every settings field and never exposes an internal id', () => {
    const row: ReglagesRow = {
      nom: 'Les Ambassades d’Afrique',
      adresse: null,
      quartier: 'Plateau Mont-Royal',
      joursOuverture: [2, 3, 4, 5, 6, 7],
      heureOuverture: '11:30',
      heureFermeture: '22:00',
      dernierService: '21:30',
      pasCreneauMinutes: 30,
      capaciteMaxReservation: 20,
      delaiMinimumHeures: 2,
      horizonJours: 90,
    }
    const dto = toRestaurantDto(row)
    expect(dto).toEqual(row)
    expect(dto).not.toHaveProperty('id')
    expect(dto).not.toHaveProperty('companyId')
  })
})
