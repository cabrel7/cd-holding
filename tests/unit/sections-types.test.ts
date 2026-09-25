// heroSchema.legende — spec phase 3 §2.2/§6 : le formulaire CMS produit toujours les 2 champs
// de la légende ensemble (type 'liste' en sous-objet, jamais un tableau) ; les 2 vides = absence.
import { describe, expect, it } from 'vitest'
import { heroSchema } from '#shared/content/sections/types'

const BASE_HERO = {
  surtitre: 'Holding — Montréal, Québec',
  titre: 'Six entreprises.\n*Une seule* exigence.',
  texte: 'Le Groupe CD est une holding diversifiée établie à Montréal.',
}

describe('heroSchema — legende', () => {
  it('should accept the absence of legende', () => {
    expect(heroSchema.safeParse(BASE_HERO).success).toBe(true)
  })

  it('should turn {surtitre:"", titre:""} into undefined', () => {
    const result = heroSchema.safeParse({ ...BASE_HERO, legende: { surtitre: '', titre: '' } })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.legende).toBeUndefined()
    }
  })

  it('should trim whitespace-only fields before deciding legende is empty', () => {
    const result = heroSchema.safeParse({ ...BASE_HERO, legende: { surtitre: '   ', titre: '  ' } })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.legende).toBeUndefined()
    }
  })

  it('should reject a legende with only one field filled', () => {
    const result = heroSchema.safeParse({ ...BASE_HERO, legende: { surtitre: 'Siège social', titre: '' } })
    expect(result.success).toBe(false)
  })

  it('should accept a fully filled legende', () => {
    const result = heroSchema.safeParse({
      ...BASE_HERO,
      legende: { surtitre: 'Siège social', titre: 'Montréal · Québec' },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.legende).toEqual({ surtitre: 'Siège social', titre: 'Montréal · Québec' })
    }
  })
})
