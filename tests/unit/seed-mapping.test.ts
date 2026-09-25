import { describe, expect, it } from 'vitest'
import {
  StatutCandidature,
  StatutCandidat,
  StatutClient,
  StatutMessage,
  StatutReservation,
} from '../../server/generated/prisma/client'
import {
  dateISOEnMontreal,
  decalerJours,
  inferCategoriePoste,
  inferNiveauExperience,
  jourSemaineVersDates,
  mapActifEmploye,
  mapCategoriePoste,
  mapForfaitComptable,
  mapOrigineCandidat,
  mapStatutCandidat,
  mapStatutCandidature,
  mapStatutClient,
  mapStatutDemande,
  mapStatutDossier,
  mapStatutMessage,
  mapStatutReservation,
  mapTypeContrat,
  montrealDateHeureToUtc,
} from '../../prisma/seed/lib/mappings'

describe('mapStatutMessage', () => {
  it('maps every prototype status to its enum value', () => {
    expect(mapStatutMessage('nouveau')).toBe(StatutMessage.NOUVEAU)
    expect(mapStatutMessage('en_cours')).toBe(StatutMessage.EN_COURS)
    expect(mapStatutMessage('traite')).toBe(StatutMessage.TRAITE)
  })
})

describe('mapStatutReservation', () => {
  it('maps every prototype status to its enum value', () => {
    expect(mapStatutReservation('en_attente')).toBe(StatutReservation.EN_ATTENTE)
    expect(mapStatutReservation('confirmee')).toBe(StatutReservation.CONFIRMEE)
    expect(mapStatutReservation('annulee')).toBe(StatutReservation.ANNULEE)
  })
})

describe('mapActifEmploye', () => {
  it('is true for "actif" and "en_conge"', () => {
    expect(mapActifEmploye('actif')).toBe(true)
    expect(mapActifEmploye('en_conge')).toBe(true)
  })

  it('is false for "inactif"', () => {
    expect(mapActifEmploye('inactif')).toBe(false)
  })
})

describe('mapCategoriePoste', () => {
  it('maps every label used by the prototype', () => {
    expect(mapCategoriePoste('Manutention')).toBe('MANUTENTION')
    expect(mapCategoriePoste('Chauffeur classe 1')).toBe('CHAUFFEUR_CLASSE_1')
    expect(mapCategoriePoste('Chauffeur classe 3')).toBe('CHAUFFEUR_CLASSE_3')
    expect(mapCategoriePoste('Chauffeur classe 5')).toBe('CHAUFFEUR_CLASSE_5')
    expect(mapCategoriePoste('Entretien')).toBe('ENTRETIEN')
    expect(mapCategoriePoste('Autre')).toBe('AUTRE')
  })
})

describe('mapStatutCandidat / mapOrigineCandidat', () => {
  it('maps candidate statuses and origins', () => {
    expect(mapStatutCandidat('disponible')).toBe(StatutCandidat.DISPONIBLE)
    expect(mapStatutCandidat('en_process')).toBe(StatutCandidat.EN_PROCESSUS)
    expect(mapStatutCandidat('place')).toBe(StatutCandidat.PLACE)
    expect(mapOrigineCandidat('local')).toBe('LOCAL')
    expect(mapOrigineCandidat('international')).toBe('INTERNATIONAL')
  })
})

describe('mapStatutDemande / mapTypeContrat / mapForfaitComptable / mapStatutDossier', () => {
  it('maps every prototype value', () => {
    expect(mapStatutDemande('ouverte')).toBe('OUVERTE')
    expect(mapStatutDemande('pourvue')).toBe('POURVUE')
    expect(mapStatutDemande('annulee')).toBe('ANNULEE')
    expect(mapTypeContrat('Temps plein')).toBe('TEMPS_PLEIN')
    expect(mapTypeContrat('Temps partiel')).toBe('TEMPS_PARTIEL')
    expect(mapTypeContrat('Temporaire')).toBe('TEMPORAIRE')
    expect(mapForfaitComptable('Mensuel')).toBe('MENSUEL')
    expect(mapForfaitComptable('Trimestriel')).toBe('TRIMESTRIEL')
    expect(mapForfaitComptable('Annuel')).toBe('ANNUEL')
    expect(mapStatutDossier('a_jour')).toBe('A_JOUR')
    expect(mapStatutDossier('en_retard')).toBe('EN_RETARD')
    expect(mapStatutDossier('en_traitement')).toBe('EN_TRAITEMENT')
  })
})

describe('mapStatutClient', () => {
  it('maps "actif" to CLIENT_ACTIF (not the literal "ACTIF")', () => {
    expect(mapStatutClient('actif')).toBe(StatutClient.CLIENT_ACTIF)
    expect(mapStatutClient('prospect')).toBe(StatutClient.PROSPECT)
    expect(mapStatutClient('inactif')).toBe(StatutClient.INACTIF)
  })
})

describe('mapStatutCandidature', () => {
  it('maps every prototype status to a valid StatutCandidature', () => {
    expect(mapStatutCandidature('recue')).toBe(StatutCandidature.NOUVELLE)
    expect(mapStatutCandidature('en_revue')).toBe(StatutCandidature.EN_REVISION)
    expect(mapStatutCandidature('entrevue')).toBe(StatutCandidature.EN_REVISION)
    expect(mapStatutCandidature('refusee')).toBe(StatutCandidature.REJETEE)
    expect(mapStatutCandidature('embauchee')).toBe(StatutCandidature.RETENUE)
  })
})

describe('montrealDateHeureToUtc', () => {
  it('converts a summer (EDT, UTC-4) date/time to UTC', () => {
    // 12 juillet 2026, 19:00 America/Montreal (EDT, -04:00) → 23:00 UTC
    const result = montrealDateHeureToUtc('2026-07-12', '19:00')
    expect(result.toISOString()).toBe('2026-07-12T23:00:00.000Z')
  })

  it('converts a winter (EST, UTC-5) date/time to UTC', () => {
    // 12 janvier 2026, 19:00 America/Montreal (EST, -05:00) → 00:00 UTC le lendemain
    const result = montrealDateHeureToUtc('2026-01-12', '19:00')
    expect(result.toISOString()).toBe('2026-01-13T00:00:00.000Z')
  })
})

describe('decalerJours', () => {
  it('shifts a UTC instant by N days, keeping the time of day', () => {
    const reference = new Date('2026-09-25T12:00:00.000Z')
    expect(decalerJours(reference, 7).toISOString()).toBe('2026-10-02T12:00:00.000Z')
    expect(decalerJours(reference, 9).toISOString()).toBe('2026-10-04T12:00:00.000Z')
    expect(decalerJours(reference, 15).toISOString()).toBe('2026-10-10T12:00:00.000Z')
  })
})

describe('dateISOEnMontreal', () => {
  it('reads the calendar day in America/Montreal, not UTC', () => {
    // 2026-01-01T02:00:00Z = 2025-12-31 21:00 EST (Montréal) : la veille.
    expect(dateISOEnMontreal(new Date('2026-01-01T02:00:00.000Z'))).toBe('2025-12-31')
  })
})

describe('inferCategoriePoste', () => {
  it('detects driver classes and other known categories', () => {
    expect(inferCategoriePoste('Chauffeur classe 1')).toBe('CHAUFFEUR_CLASSE_1')
    expect(inferCategoriePoste('Manutentionnaire')).toBe('MANUTENTION')
    expect(inferCategoriePoste("Préposée à l'entretien")).toBe('ENTRETIEN')
  })

  it('falls back to AUTRE for unknown titles', () => {
    expect(inferCategoriePoste('Réceptionniste')).toBe('AUTRE')
  })
})

describe('inferNiveauExperience', () => {
  it('buckets years of experience from free text', () => {
    expect(inferNiveauExperience('4 ans en entrepôt alimentaire.')).toBe('TROIS_A_CINQ_ANS')
    expect(inferNiveauExperience('9 ans de longue distance.')).toBe('PLUS_5_ANS')
    expect(inferNiveauExperience('2 ans en entretien commercial.')).toBe('UN_A_TROIS_ANS')
  })

  it('returns undefined when no year count is found', () => {
    expect(inferNiveauExperience('Expérience non précisée.')).toBeUndefined()
  })
})

describe('jourSemaineVersDates', () => {
  it('resolves the ISO weekday of the current Montreal week from a reference date', () => {
    // Référence : vendredi 25 septembre 2026, midi UTC.
    const reference = new Date('2026-09-25T12:00:00.000Z')
    const { dateDebut } = jourSemaineVersDates(reference, 'lundi', '18:00', '23:00')
    // Le lundi de cette même semaine ISO est le 21 septembre 2026.
    expect(dateDebut.toISOString()).toBe('2026-09-21T22:00:00.000Z') // 18:00 EDT = 22:00 UTC
  })

  it('rolls the end date to the next day for an overnight shift', () => {
    const reference = new Date('2026-09-25T12:00:00.000Z')
    const { dateDebut, dateFin } = jourSemaineVersDates(reference, 'lundi', '22:00', '06:00')
    expect(dateDebut.toISOString()).toBe('2026-09-22T02:00:00.000Z') // 22:00 EDT lundi
    expect(dateFin.toISOString()).toBe('2026-09-22T10:00:00.000Z') // 06:00 EDT mardi (lendemain)
    expect(dateFin.getTime()).toBeGreaterThan(dateDebut.getTime())
  })
})
