import { describe, expect, it } from 'vitest'
import { nettoyerNomFichier } from '../../server/utils/storage'

describe('nettoyerNomFichier', () => {
  it('keeps a normal filename untouched', () => {
    expect(nettoyerNomFichier('cv-jean-tremblay.pdf')).toBe('cv-jean-tremblay.pdf')
  })

  it('reduces a POSIX path to its last segment (never used as a storage path)', () => {
    expect(nettoyerNomFichier('../../etc/passwd')).toBe('passwd')
  })

  it('reduces a Windows-style path to its last segment', () => {
    expect(nettoyerNomFichier('C:\\Users\\jean\\Documents\\cv.pdf')).toBe('cv.pdf')
  })

  it('strips control characters (a NUL would otherwise make Postgres fail with a 500)', () => {
    expect(nettoyerNomFichier('cv\u0000.pdf')).toBe('cv.pdf')
    expect(nettoyerNomFichier('cv\u001Fmalicious.pdf')).toBe('cvmalicious.pdf')
  })

  it('normalizes to Unicode NFC', () => {
    const decompose = 'cve\u0301.pdf' // "é" décomposé (e + accent combinant)
    expect(nettoyerNomFichier(decompose)).toBe('cvé.pdf'.normalize('NFC'))
    expect(nettoyerNomFichier(decompose)).toHaveLength('cvé.pdf'.length)
  })

  it('truncates to 255 characters at most', () => {
    const long = `${'a'.repeat(300)}.pdf`
    const result = nettoyerNomFichier(long)
    expect(result.length).toBeLessThanOrEqual(255)
  })

  it('falls back to "fichier" when the name is empty, missing, or only control characters', () => {
    expect(nettoyerNomFichier(undefined)).toBe('fichier')
    expect(nettoyerNomFichier('')).toBe('fichier')
    expect(nettoyerNomFichier('\u0000\u0001')).toBe('fichier')
  })
})
