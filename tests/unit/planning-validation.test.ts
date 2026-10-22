import { describe, expect, it } from 'vitest'
import { JOURS_FR, PLANNING_SITES } from '#shared/config/planning'
import { dureeMinutes, lundiDeSemaineQuebec, totalHeures } from '#shared/utils/planning'
import { planningSiteSchema, planningSemaineQuerySchema, quartCreateSchema, quartUpdateSchema } from '#shared/validation/planning'

describe('planningSiteSchema', () => {
  it('accepte les 3 filiales du module, refuse les autres', () => {
    expect([...PLANNING_SITES]).toEqual(['entretien', 'transport', 'ccdpaa'])
    expect(planningSiteSchema.parse('entretien')).toBe('entretien')
    expect(() => planningSiteSchema.parse('holding')).toThrow()
    expect(() => planningSiteSchema.parse('comptable')).toThrow()
  })
})

describe('planningSemaineQuerySchema', () => {
  it('accepte un lundi ISO, refuse dimanche et formats invalides', () => {
    expect(planningSemaineQuerySchema.parse({ semaine: '2026-10-05' }).semaine).toBe('2026-10-05')
    expect(planningSemaineQuerySchema.parse({}).semaine).toBeUndefined()
    expect(() => planningSemaineQuerySchema.parse({ semaine: '2026-10-04' })).toThrow()
    expect(() => planningSemaineQuerySchema.parse({ semaine: '05/10/2026' })).toThrow()
    expect(() => planningSemaineQuerySchema.parse({ semaine: '2026-02-30' })).toThrow()
    expect(() => planningSemaineQuerySchema.parse({ semaine: '2026-10-05', extra: 1 })).toThrow()
  })
})

const QUART_VALIDE = {
  employeUuid: '00000000-0000-0000-0000-000000000000',
  dateDebut: '2026-10-05T12:00:00Z',
  dateFin: '2026-10-05T20:00:00Z',
  lieu: 'Cuisine centrale',
}

describe('quartCreateSchema', () => {
  it('accepte un quart complet, champ vidé → null (effacé)', () => {
    const parsed = quartCreateSchema.parse({ ...QUART_VALIDE, titre: '', notes: '' })
    expect(parsed.titre).toBeNull()
    expect(parsed.notes).toBeNull()
  })

  it('accepte une nuit (fin avant début) sans vérification', () => {
    const parsed = quartCreateSchema.parse({ ...QUART_VALIDE, dateDebut: '2026-10-05T22:00:00Z', dateFin: '2026-10-06T06:00:00Z' })
    expect(parsed.dateFin).toBe('2026-10-06T06:00:00Z')
  })

  it('refuse lieu vide, ISO invalide, uuid invalide et champ inconnu', () => {
    expect(() => quartCreateSchema.parse({ ...QUART_VALIDE, lieu: '   ' })).toThrow()
    expect(() => quartCreateSchema.parse({ ...QUART_VALIDE, dateDebut: 'demain 8h' })).toThrow()
    expect(() => quartCreateSchema.parse({ ...QUART_VALIDE, employeUuid: 'abc' })).toThrow()
    expect(() => quartCreateSchema.parse({ ...QUART_VALIDE, inconnu: 1 })).toThrow()
  })
})

describe('quartUpdateSchema', () => {
  it('partiel mais non vide, strict, champ vidé → null (efface)', () => {
    expect(quartUpdateSchema.parse({ lieu: 'Salle' })).toEqual({ lieu: 'Salle' })
    expect(quartUpdateSchema.parse({ titre: '' })).toEqual({ titre: null })
    expect(() => quartUpdateSchema.parse({})).toThrow()
    expect(() => quartUpdateSchema.parse({ lieu: 'Salle', inconnu: 1 })).toThrow()
  })
})

describe('lundiDeSemaineQuebec', () => {
  it('recule au lundi, lundi → lui-même, dimanche → lundi précédent', () => {
    expect(lundiDeSemaineQuebec('2026-10-07')).toBe('2026-10-05')
    expect(lundiDeSemaineQuebec('2026-10-05')).toBe('2026-10-05')
    expect(lundiDeSemaineQuebec('2026-10-11')).toBe('2026-10-05')
  })

  it('ne glisse pas autour du changement d’heure (1er nov. 2026)', () => {
    expect(lundiDeSemaineQuebec('2026-11-04')).toBe('2026-11-02')
    expect(lundiDeSemaineQuebec('2026-11-01')).toBe('2026-10-26')
  })
})

describe('dureeMinutes', () => {
  it('journée normale, nuit +24 h, durée nulle → 24 h', () => {
    expect(dureeMinutes(new Date('2026-10-05T12:00:00Z'), new Date('2026-10-05T20:00:00Z'))).toBe(480)
    expect(dureeMinutes(new Date('2026-10-05T22:00:00Z'), new Date('2026-10-06T06:00:00Z'))).toBe(480)
    expect(dureeMinutes(new Date('2026-10-05T08:00:00Z'), new Date('2026-10-05T08:00:00Z'))).toBe(1440)
  })
})

describe('totalHeures', () => {
  it('somme nuits incluses, arrondi à 0.1', () => {
    const quarts = [
      { dateDebut: new Date('2026-10-05T12:00:00Z'), dateFin: new Date('2026-10-05T14:30:00Z') },
      { dateDebut: new Date('2026-10-06T22:00:00Z'), dateFin: new Date('2026-10-07T06:00:00Z') },
    ]
    expect(totalHeures(quarts)).toBe(10.5)
    expect(totalHeures([{ dateDebut: new Date('2026-10-05T12:00:00Z'), dateFin: new Date('2026-10-05T13:20:00Z') }])).toBe(1.3)
  })
})

describe('JOURS_FR', () => {
  it('couvre lun→dim', () => {
    expect([...JOURS_FR]).toEqual(['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'])
  })
})
