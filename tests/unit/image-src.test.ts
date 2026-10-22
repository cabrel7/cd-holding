import { describe, expect, it } from 'vitest'
import {
  LARGEURS_DERIVEES,
  srcsetImage,
  srcsetImageMax,
  urlImage,
} from '#shared/utils/image-src'

describe('urlImage', () => {
  it('sers the raw file without options', () => {
    expect(urlImage('abc-123.jpg')).toBe('/api/files/abc-123.jpg')
  })

  it('adds width and format query parameters', () => {
    expect(urlImage('abc.jpg', { largeur: 768, format: 'webp' })).toBe('/api/files/abc.jpg?f=webp&w=768')
    expect(urlImage('abc.jpg', { format: 'webp' })).toBe('/api/files/abc.jpg?f=webp')
    expect(urlImage('abc.jpg', { largeur: 480 })).toBe('/api/files/abc.jpg?w=480')
  })

  it('uses only allowlisted widths', () => {
    for (const largeur of LARGEURS_DERIVEES) {
      expect(urlImage('k.jpg', { largeur })).toContain(`w=${largeur}`)
    }
    expect(LARGEURS_DERIVEES).toEqual([480, 768, 1024, 1280, 1600])
  })
})

describe('srcsetImage', () => {
  it('lists every allowlisted width in webp with w descriptors', () => {
    const srcset = srcsetImage('abc.jpg')
    const parties = srcset.split(', ')
    expect(parties).toHaveLength(LARGEURS_DERIVEES.length)
    expect(parties[0]).toBe('/api/files/abc.jpg?f=webp&w=480 480w')
    expect(parties.at(-1)).toBe('/api/files/abc.jpg?f=webp&w=1600 1600w')
  })
})

describe('srcsetImageMax', () => {
  it('picks the largest allowed width below the cap', () => {
    expect(srcsetImageMax('abc.jpg', 192)).toBe('/api/files/abc.jpg?f=webp&w=480')
    expect(srcsetImageMax('abc.jpg', 768)).toBe('/api/files/abc.jpg?f=webp&w=768')
  })

  it('falls back to the smallest width when the cap is below the ladder', () => {
    expect(srcsetImageMax('abc.jpg', 100)).toBe('/api/files/abc.jpg?f=webp&w=480')
  })
})
