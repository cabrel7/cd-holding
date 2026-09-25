import { describe, expect, it } from 'vitest'
import { interpoler, mergerVars, segmenterTexteAccentue, texteAccentueSegments } from '#shared/utils/texte'

describe('interpoler', () => {
  it('should replace known variables', () => {
    expect(interpoler('Bienvenue chez {groupe}', { groupe: 'Groupe CD' })).toBe('Bienvenue chez Groupe CD')
  })

  it('should replace several distinct variables', () => {
    expect(interpoler('{nomCourt}, filiale de {nom}', { nomCourt: 'CCDPAA', nom: 'Groupe CD' })).toBe(
      'CCDPAA, filiale de Groupe CD',
    )
  })

  it('should leave an unknown variable untouched', () => {
    expect(interpoler('Texte {inconnue} ici', {})).toBe('Texte {inconnue} ici')
  })

  it('should leave a known variable untouched when its value is missing', () => {
    expect(interpoler('Bienvenue chez {groupe}', {})).toBe('Bienvenue chez {groupe}')
  })
})

describe('mergerVars', () => {
  it('should use base values when no override is provided', () => {
    expect(mergerVars({ groupe: 'Groupe CD' })).toEqual({ groupe: 'Groupe CD' })
  })

  it('should keep the base value when an override is explicitly undefined', () => {
    expect(mergerVars({ groupe: 'Groupe CD' }, { groupe: undefined })).toEqual({ groupe: 'Groupe CD' })
  })

  it('should let an explicit override win over the base value', () => {
    expect(mergerVars({ groupe: 'Groupe CD' }, { groupe: 'Autre groupe' })).toEqual({ groupe: 'Autre groupe' })
  })

  it('should merge distinct keys from base and overrides', () => {
    expect(mergerVars({ groupe: 'Groupe CD' }, { nomCourt: 'CCDPAA' })).toEqual({
      groupe: 'Groupe CD',
      nomCourt: 'CCDPAA',
    })
  })
})

describe('segmenterTexteAccentue', () => {
  it('should extract a single accented segment', () => {
    expect(segmenterTexteAccentue('Un *mot* accentué')).toEqual([
      { type: 'texte', valeur: 'Un ' },
      { type: 'accent', valeur: 'mot' },
      { type: 'texte', valeur: ' accentué' },
    ])
  })

  it('should turn \\n into a line-break segment', () => {
    expect(segmenterTexteAccentue('Ligne 1\nLigne 2')).toEqual([
      { type: 'texte', valeur: 'Ligne 1' },
      { type: 'saut' },
      { type: 'texte', valeur: 'Ligne 2' },
    ])
  })

  it('should handle several accents on the same line', () => {
    expect(segmenterTexteAccentue('*a* et *b*')).toEqual([
      { type: 'accent', valeur: 'a' },
      { type: 'texte', valeur: ' et ' },
      { type: 'accent', valeur: 'b' },
    ])
  })

  it('should return a single texte segment when there is nothing to accent', () => {
    expect(segmenterTexteAccentue('Texte simple')).toEqual([{ type: 'texte', valeur: 'Texte simple' }])
  })
})

describe('texteAccentueSegments', () => {
  it('should interpolate then segment in one pass, never emitting HTML', () => {
    const segments = texteAccentueSegments('*{groupe}* est fier de vous', { groupe: 'Groupe CD' })
    expect(segments).toEqual([
      { type: 'accent', valeur: 'Groupe CD' },
      { type: 'texte', valeur: ' est fier de vous' },
    ])
    expect(segments.every((s) => !('valeur' in s) || !s.valeur.includes('<'))).toBe(true)
  })
})
