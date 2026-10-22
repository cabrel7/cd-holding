import { describe, expect, it, vi } from 'vitest'
import { construireReservation, ecrireIdempotent, recapitulatifReservation, toRestaurantDto, type ReglagesRow } from '../../server/lib/reservation'
import { toReservationDto, type ReservationMapRow } from '../../server/services/admin/reservations'
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

describe('ecrireIdempotent', () => {
  const conflit = Object.assign(new Error('conflict'), { code: 'P2034' })

  it('should return the outcome directly when no conflict occurs', async () => {
    expect(await ecrireIdempotent(async () => 'creee', async () => false)).toBe('creee')
  })

  it('should answer "existante" when a conflict is followed by an identical row', async () => {
    const tenter = vi.fn().mockRejectedValue(conflit)
    expect(await ecrireIdempotent(tenter, async () => true)).toBe('existante')
    expect(tenter).toHaveBeenCalledTimes(1)
  })

  it('should retry once when a conflict leaves no identical row', async () => {
    const tenter = vi.fn().mockRejectedValueOnce(conflit).mockResolvedValueOnce('creee')
    expect(await ecrireIdempotent(tenter, async () => false)).toBe('creee')
    expect(tenter).toHaveBeenCalledTimes(2)
  })

  it('should propagate a second conflict and non-conflict errors', async () => {
    await expect(ecrireIdempotent(vi.fn().mockRejectedValue(conflit), async () => false)).rejects.toBe(conflit)
    const autre = new Error('boom')
    await expect(ecrireIdempotent(vi.fn().mockRejectedValue(autre), async () => true)).rejects.toBe(autre)
  })
})

// --- Lot 5 : mapping admin (toReservationDto) --------------------------------------------------

const ROW: ReservationMapRow = {
  uuid: '0b3f1a2c-0000-4000-8000-000000000020',
  nom: 'Awa Diop',
  email: 'awa@exemple.ca',
  telephone: '514-000-0000',
  nombrePersonnes: 4,
  dateReservation: new Date('2026-10-14T23:30:00.000Z'),
  notes: 'Allergie aux arachides',
  statut: 'EN_ATTENTE',
  createdAt: new Date('2026-10-07T12:00:00.000Z'),
  company: { uuid: '0b3f1a2c-0000-4000-8000-000000000001', slug: 'cdpaa', nom: 'Les Ambassades d’Afrique' },
}

describe('toReservationDto', () => {
  it('maps every field with the exact DTO keys and never exposes internal ids', () => {
    const dto = toReservationDto(ROW)
    expect(Object.keys(dto).sort()).toEqual(
      [
        'createdAt',
        'dateReservation',
        'email',
        'nom',
        'nombrePersonnes',
        'notes',
        'site',
        'statut',
        'telephone',
        'uuid',
      ].sort(),
    )
    expect(dto).not.toHaveProperty('id')
    expect(dto).not.toHaveProperty('companyId')
    expect(dto).toEqual({
      uuid: ROW.uuid,
      nom: 'Awa Diop',
      email: 'awa@exemple.ca',
      telephone: '514-000-0000',
      nombrePersonnes: 4,
      dateReservation: '2026-10-14T23:30:00.000Z',
      notes: 'Allergie aux arachides',
      statut: 'EN_ATTENTE',
      site: { uuid: ROW.company.uuid, slug: 'cdpaa', nom: 'Les Ambassades d’Afrique' },
      createdAt: '2026-10-07T12:00:00.000Z',
    })
  })

  it('serializes both dates as ISO 8601 UTC strings', () => {
    const dto = toReservationDto(ROW)
    expect(dto.dateReservation).toBe('2026-10-14T23:30:00.000Z')
    expect(dto.createdAt).toBe('2026-10-07T12:00:00.000Z')
    expect(new Date(dto.dateReservation).toISOString()).toBe(dto.dateReservation)
    expect(new Date(dto.createdAt).toISOString()).toBe(dto.createdAt)
  })

  it('exposes the site ref as an AdminSiteRef (uuid + slug + nom)', () => {
    const dto = toReservationDto(ROW)
    expect(Object.keys(dto.site!).sort()).toEqual(['nom', 'slug', 'uuid'])
    expect(dto.site!.slug).toBe('cdpaa')
  })

  it('keeps notes nullable', () => {
    expect(toReservationDto({ ...ROW, notes: null }).notes).toBeNull()
  })
})
