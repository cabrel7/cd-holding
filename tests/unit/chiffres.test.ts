import { describe, expect, it } from 'vitest'
import { arrondirDizaineInferieure, formaterEffectif, resolveChiffreItem, resolveChiffres } from '#shared/utils/chiffres'
import type { ChiffreItem } from '#shared/content/sections/types'

describe('arrondirDizaineInferieure', () => {
  it('should round down to the nearest ten', () => {
    expect(arrondirDizaineInferieure(25)).toBe(20)
    expect(arrondirDizaineInferieure(29)).toBe(20)
    expect(arrondirDizaineInferieure(20)).toBe(20)
  })

  it('should never go negative', () => {
    expect(arrondirDizaineInferieure(0)).toBe(0)
  })
})

describe('formaterEffectif', () => {
  it('should append "+" when rounded', () => {
    expect(formaterEffectif(37, true)).toBe('30+')
  })

  it('should return the exact value when not rounded', () => {
    expect(formaterEffectif(37, false)).toBe('37')
  })
})

describe('resolveChiffreItem', () => {
  const ctx = { effectifTotal: 65, nombreFiliales: 6 }

  it('should resolve a "libre" item verbatim', () => {
    const item: ChiffreItem = { type: 'libre', valeur: '15+', libelle: 'ans d\'expérience' }
    expect(resolveChiffreItem(item, ctx)).toEqual({ valeur: '15+', libelle: "ans d'expérience" })
  })

  it('should resolve an "effectif" item from context, rounded', () => {
    const item: ChiffreItem = { type: 'effectif', libelle: 'employés', arrondi: true }
    expect(resolveChiffreItem(item, ctx)).toEqual({ valeur: '60+', libelle: 'employés' })
  })

  it('should resolve a "filiales" item from context', () => {
    const item: ChiffreItem = { type: 'filiales', libelle: 'filiales' }
    expect(resolveChiffreItem(item, ctx)).toEqual({ valeur: '6', libelle: 'filiales' })
  })
})

describe('resolveChiffres', () => {
  it('should resolve every item in order, only one effectif shown across the whole catalogue', () => {
    const ctx = { effectifTotal: 65, nombreFiliales: 6 }
    const items: ChiffreItem[] = [
      { type: 'filiales', libelle: 'filiales' },
      { type: 'effectif', libelle: 'employés', arrondi: true },
    ]
    expect(resolveChiffres(items, ctx)).toEqual([
      { valeur: '6', libelle: 'filiales' },
      { valeur: '60+', libelle: 'employés' },
    ])
  })
})
