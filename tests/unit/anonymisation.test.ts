import { describe, expect, it } from 'vitest'
import { ajouterMois, echanceAnonymisation, echeanceVivier } from '../../server/lib/anonymisation'
import { LOI25_DUREES } from '#shared/config/candidature'

const ISO = (d: Date | null) => d?.toISOString() ?? null
const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

describe('ajouterMois', () => {
  it('conserve le jour quand il existe au mois cible', () => {
    expect(ISO(ajouterMois(utc('2026-01-15'), 1))).toBe('2026-02-15T00:00:00.000Z')
  })

  it('ramène au dernier jour du mois cible quand le jour n’existe pas', () => {
    expect(ISO(ajouterMois(utc('2026-01-31'), 1))).toBe('2026-02-28T00:00:00.000Z')
    expect(ISO(ajouterMois(utc('2024-01-31'), 1))).toBe('2024-02-29T00:00:00.000Z')
  })

  it('préserve l’heure murale UTC', () => {
    const date = new Date('2026-01-15T13:45:30.500Z')
    expect(ISO(ajouterMois(date, 1))).toBe('2026-02-15T13:45:30.500Z')
  })

  it('gère les mois négatifs sans glisser', () => {
    expect(ISO(ajouterMois(utc('2026-03-31'), -1))).toBe('2026-02-28T00:00:00.000Z')
  })

  it('traverse correctement les fins d’année', () => {
    expect(ISO(ajouterMois(utc('2026-12-31'), 1))).toBe('2027-01-31T00:00:00.000Z')
  })
})

describe('echanceAnonymisation', () => {
  const base = { rejeteLe: null, dateEnvoi: utc('2026-01-10') }

  it('ne ré-anonymise jamais une candidature déjà anonymisée', () => {
    expect(echanceAnonymisation({ ...base, statut: 'NOUVELLE', anonymiseLe: utc('2026-02-01') })).toBeNull()
  })

  it('n’anonymise pas une candidature RETENUE (bascule vivier = décision humaine)', () => {
    expect(echanceAnonymisation({ ...base, statut: 'RETENUE', anonymiseLe: null })).toBeNull()
  })

  it('rejet : rejeteLe + 6 mois', () => {
    const rejeteLe = utc('2026-03-05')
    expect(ISO(echanceAnonymisation({ rejeteLe, dateEnvoi: utc('2025-01-01'), statut: 'REJETEE', anonymiseLe: null }))).toBe(
      ISO(ajouterMois(rejeteLe, LOI25_DUREES.rejetMois)),
    )
  })

  it('rejet sans date de rejet : retombe sur dateEnvoi + 6 mois', () => {
    expect(ISO(echanceAnonymisation({ ...base, statut: 'REJETEE', anonymiseLe: null }))).toBe(
      ISO(ajouterMois(base.dateEnvoi, LOI25_DUREES.nonTraiteeMois)),
    )
  })

  it('jamais traitée : dateEnvoi + 6 mois', () => {
    expect(ISO(echanceAnonymisation({ ...base, statut: 'EN_REVISION', anonymiseLe: null }))).toBe(
      ISO(ajouterMois(base.dateEnvoi, LOI25_DUREES.nonTraiteeMois)),
    )
  })
})

describe('echeanceVivier', () => {
  it('ne ré-anonymise jamais un candidat déjà anonymisé', () => {
    expect(
      echeanceVivier({ anonymiseLe: utc('2026-02-01'), consentementRenouveleLe: null, createdAt: utc('2025-01-01') }),
    ).toBeNull()
  })

  it('sans renouvellement : createdAt + 12 mois', () => {
    const createdAt = utc('2025-06-15')
    expect(ISO(echeanceVivier({ anonymiseLe: null, consentementRenouveleLe: null, createdAt }))).toBe(
      ISO(ajouterMois(createdAt, LOI25_DUREES.vivierMois)),
    )
  })

  it('le renouvellement de consentement repousse l’échéance', () => {
    const consentementRenouveleLe = utc('2026-09-01')
    expect(
      ISO(
        echeanceVivier({
          anonymiseLe: null,
          consentementRenouveleLe,
          createdAt: utc('2025-01-01'),
        }),
      ),
    ).toBe(ISO(ajouterMois(consentementRenouveleLe, LOI25_DUREES.vivierMois)))
  })
})
