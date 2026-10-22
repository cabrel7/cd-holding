import { describe, expect, it } from 'vitest'
import {
  FILIALE_SLUGS,
  HOLDING_SLUG,
  isFilialeSlug,
  isSiteSlug,
  contactPath,
  FILIALE_DUO_LIENS,
  publicNav,
  SITE_EXTRA_PAGES,
  SITE_SLUGS,
  siteSlugSchema,
} from '#shared/config/sites'

describe('SITE_SLUGS', () => {
  it('should list the holding first, followed by the 6 filiales', () => {
    expect(SITE_SLUGS[0]).toBe(HOLDING_SLUG)
    expect(SITE_SLUGS.slice(1)).toEqual(FILIALE_SLUGS)
    expect(SITE_SLUGS).toHaveLength(7)
  })
})

describe('isFilialeSlug', () => {
  it('should accept a filiale slug', () => {
    expect(isFilialeSlug('cdpaa')).toBe(true)
  })

  it('should reject the holding slug', () => {
    expect(isFilialeSlug('holding')).toBe(false)
  })

  it('should reject an unknown slug', () => {
    expect(isFilialeSlug('inconnu')).toBe(false)
  })
})

describe('isSiteSlug', () => {
  it('should accept the holding and every filiale', () => {
    expect(isSiteSlug('holding')).toBe(true)
    for (const slug of FILIALE_SLUGS) expect(isSiteSlug(slug)).toBe(true)
  })

  it('should reject an unknown slug', () => {
    expect(isSiteSlug('inconnu')).toBe(false)
  })
})

describe('siteSlugSchema', () => {
  it('should parse every known slug', () => {
    for (const slug of SITE_SLUGS) {
      expect(siteSlugSchema.safeParse(slug).success).toBe(true)
    }
  })

  it('should reject an unknown slug', () => {
    expect(siteSlugSchema.safeParse('autre').success).toBe(false)
  })
})

describe('SITE_EXTRA_PAGES', () => {
  it('should list restaurant for cdpaa and offres for placement only', () => {
    expect(SITE_EXTRA_PAGES.cdpaa).toEqual(['restaurant'])
    expect(SITE_EXTRA_PAGES.placement).toEqual(['offres'])
    expect(SITE_EXTRA_PAGES.entretien).toBeUndefined()
  })
})

describe('publicNav', () => {
  it('should expose the holding-specific nav without Accueil/Services', () => {
    const nav = publicNav('holding')
    expect(nav.map((item) => item.label)).toEqual(['Nos filiales', 'Réalisations', 'À propos', 'Contact'])
    expect(nav[0]?.hash).toBe('#filiales')
  })

  it('should add Restaurant only for cdpaa', () => {
    const nav = publicNav('cdpaa')
    expect(nav.map((item) => item.label)).toContain('Restaurant')
    expect(publicNav('entretien').map((item) => item.label)).not.toContain('Restaurant')
  })

  it('should add Offres only for placement', () => {
    const nav = publicNav('placement')
    expect(nav.map((item) => item.label)).toContain('Offres')
    expect(publicNav('boissons').map((item) => item.label)).not.toContain('Offres')
  })

  it('should end every filiale nav with Réalisations, À propos, Contact', () => {
    const nav = publicNav('transport')
    expect(nav.slice(-3).map((item) => item.label)).toEqual(['Réalisations', 'À propos', 'Contact'])
  })
})

describe('contactPath', () => {
  it('should return the root contact page for the holding', () => {
    expect(contactPath('holding')).toBe('/contact')
  })

  it('should return the subsidiary contact page for a filiale', () => {
    expect(contactPath('entretien')).toBe('/entretien/contact')
  })

  it('should match the Contact entry of each site navigation', () => {
    for (const slug of ['holding', 'cdpaa'] as const) {
      expect(publicNav(slug).find((item) => item.label === 'Contact')?.to).toBe(contactPath(slug))
    }
  })
})

describe('FILIALE_DUO_LIENS', () => {
  it('should define duo links only for placement (audiences) and cdpaa (metiers)', () => {
    expect(Object.keys(FILIALE_DUO_LIENS).sort()).toEqual(['cdpaa', 'placement'])
    expect(FILIALE_DUO_LIENS.placement).toEqual({ cle: 'audiences', a: contactPath('placement'), b: '/placement/offres' })
    expect(FILIALE_DUO_LIENS.cdpaa?.cle).toBe('metiers')
  })
})
