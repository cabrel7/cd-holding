import { describe, expect, it } from 'vitest'
import {
  ETAPES_ASSISTANT,
  NOMBRE_ETAPES,
  palierRecommandation,
  recapReponses,
  type ReponsesAssistant,
  type VolumeAssistant,
} from '#shared/content/cdpaa/assistant-import-export'
import { assistantBodySchema } from '#shared/validation/contact'

const KEBAB_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

const REPONSES_VALIDES: ReponsesAssistant = {
  profil: 'epicerie',
  categorie: 'tubercules',
  volume: '200-1000kg',
  delai: 'immediat',
}

describe('ETAPES_ASSISTANT', () => {
  it('should expose one more step than the questionnaire for the contact step', () => {
    expect(NOMBRE_ETAPES).toBe(ETAPES_ASSISTANT.length + 1)
  })

  it('should have unique, kebab-case option values within each step', () => {
    for (const etape of ETAPES_ASSISTANT) {
      const valeurs = etape.options.map((o) => o.value)
      expect(new Set(valeurs).size).toBe(valeurs.length)
      for (const valeur of valeurs) expect(valeur).toMatch(KEBAB_PATTERN)
    }
  })

  it('should give every possible volume a recommendation tier', () => {
    const etapeVolume = ETAPES_ASSISTANT.find((e) => e.cle === 'volume')
    expect(etapeVolume).toBeDefined()
    for (const option of etapeVolume?.options ?? []) {
      expect(() => palierRecommandation(option.value as VolumeAssistant)).not.toThrow()
      expect(['petit', 'moyen', 'grand']).toContain(palierRecommandation(option.value as VolumeAssistant))
    }
  })
})

describe('recapReponses', () => {
  it('should return the human label for each answer, in step order', () => {
    const recap = recapReponses(REPONSES_VALIDES)
    expect(recap.map((r) => r.libelle)).toEqual(['Profil', 'Catégorie', 'Volume mensuel', 'Échéance'])
    expect(recap.find((r) => r.libelle === 'Profil')?.valeur).toBe('Épicerie spécialisée')
  })
})

describe('assistantBodySchema', () => {
  const base = {
    nom: 'Jean Tremblay',
    email: 'jean@exemple.ca',
    formulaire: 'assistant' as const,
    reponses: REPONSES_VALIDES,
  }

  it('should accept a valid submission', () => {
    expect(assistantBodySchema.safeParse(base).success).toBe(true)
  })

  it('should reject an unknown answer value', () => {
    const result = assistantBodySchema.safeParse({ ...base, reponses: { ...REPONSES_VALIDES, profil: 'inconnu' } })
    expect(result.success).toBe(false)
  })

  it('should reject an extra key in reponses (strict)', () => {
    const result = assistantBodySchema.safeParse({ ...base, reponses: { ...REPONSES_VALIDES, extra: 'x' } })
    expect(result.success).toBe(false)
  })
})
