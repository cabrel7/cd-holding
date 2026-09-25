import { describe, expect, it } from 'vitest'
import { collectImageKeys } from '../../server/utils/public-images'

describe('collectImageKeys', () => {
  it('collects the imageKey of a hero section', () => {
    const donnees = { surtitre: 'S', titre: 'T', texte: 'X', imageKey: 'abc.jpg' }
    expect(collectImageKeys('hero', donnees)).toEqual(['abc.jpg'])
  })

  it('returns an empty array when no image is set', () => {
    expect(collectImageKeys('hero', { surtitre: 'S', titre: 'T', texte: 'X' })).toEqual([])
  })

  it('ignores a null imageKey', () => {
    expect(collectImageKeys('hero', { surtitre: 'S', titre: 'T', texte: 'X', imageKey: null })).toEqual([])
  })

  it('collects the image keys of both sides of a duo section', () => {
    const donnees = {
      a: { titre: 'A', lienLibelle: 'Voir', imageKey: 'a.jpg' },
      b: { titre: 'B', lienLibelle: 'Voir', imageKey: 'b.jpg' },
    }
    expect(collectImageKeys('duo', donnees).sort()).toEqual(['a.jpg', 'b.jpg'])
  })

  it('collects image keys from every item of a gallery', () => {
    const donnees = {
      titre: 'Menu',
      items: [
        { titre: 'Plat 1', imageKey: 'p1.jpg' },
        { titre: 'Plat 2' },
        { titre: 'Plat 3', imageKey: 'p3.jpg' },
      ],
    }
    expect(collectImageKeys('galerie', donnees).sort()).toEqual(['p1.jpg', 'p3.jpg'])
  })

  it('returns an empty array for a type without any image field', () => {
    expect(collectImageKeys('texte', { texte: 'Bonjour' })).toEqual([])
  })

  it('returns an empty array for malformed (non-object) donnees', () => {
    expect(collectImageKeys('hero', null)).toEqual([])
    expect(collectImageKeys('hero', 'pas-un-objet')).toEqual([])
  })
})
