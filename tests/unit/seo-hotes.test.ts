import { describe, expect, it } from 'vitest'
import { HOLDING_SLUG } from '#shared/config/sites'
import { cheminsDuSite, robotsPublic, ROBOTS_ADMIN, sitemapPublic, type CibleSeo } from '../../server/lib/seo-hotes'

function cible(overrides: Partial<CibleSeo> = {}): CibleSeo {
  return { slug: HOLDING_SLUG, hoteConnu: true, base: 'https://chauvierdelor.com', ...overrides }
}

describe('cheminsDuSite', () => {
  it('includes confidentialite on the holding and not mentions-legales', () => {
    const chemins = cheminsDuSite(HOLDING_SLUG)
    expect(chemins).toContain('/')
    expect(chemins).toContain('/confidentialite')
    expect(chemins).not.toContain('/mentions-legales')
    expect(chemins).not.toContain('/services')
  })

  it('includes mentions-legales and the socle on a generic filiale', () => {
    const chemins = cheminsDuSite('transport')
    expect(chemins).toEqual(
      expect.arrayContaining(['/', '/services', '/realisations', '/a-propos', '/contact', '/mentions-legales']),
    )
    expect(chemins).not.toContain('/restaurant')
    expect(chemins).not.toContain('/offres')
  })

  it('includes the extra pages of placement and cdpaa', () => {
    expect(cheminsDuSite('placement')).toContain('/offres')
    expect(cheminsDuSite('cdpaa')).toContain('/restaurant')
  })

  it('never emits a fragment', () => {
    for (const chemin of cheminsDuSite(HOLDING_SLUG)) {
      expect(chemin).not.toContain('#')
    }
  })
})

describe('robotsPublic', () => {
  it('allows crawling and points to the sitemap of the host when known', () => {
    const corps = robotsPublic(cible())
    expect(corps).toContain('User-agent: *')
    expect(corps).toContain('Allow: /')
    expect(corps).toContain('Sitemap: https://chauvierdelor.com/sitemap.xml')
  })

  it('omits the sitemap when the host is unknown (dev)', () => {
    const corps = robotsPublic(cible({ hoteConnu: false }))
    expect(corps).toContain('Allow: /')
    expect(corps).not.toContain('Sitemap:')
  })
})

describe('ROBOTS_ADMIN', () => {
  it('disallows everything', () => {
    expect(ROBOTS_ADMIN).toContain('User-agent: *')
    expect(ROBOTS_ADMIN).toContain('Disallow: /')
  })
})

describe('sitemapPublic', () => {
  it('emits an urlset with absolute URLs matching the canonical host', () => {
    const corps = sitemapPublic(cible({ slug: 'cdpaa', base: 'https://cdpaa.chauvierdelor.com' }))
    expect(corps).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(corps).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(corps).toContain('<loc>https://cdpaa.chauvierdelor.com/</loc>')
    expect(corps).toContain('<loc>https://cdpaa.chauvierdelor.com/restaurant</loc>')
    expect(corps).toContain('<loc>https://cdpaa.chauvierdelor.com/services</loc>')
    expect(corps).not.toContain('<loc>https://chauvierdelor.com/')
  })

  it('uses the bare root for the holding apex', () => {
    const corps = sitemapPublic(cible())
    expect(corps).toContain('<loc>https://chauvierdelor.com/</loc>')
    expect(corps).toContain('<loc>https://chauvierdelor.com/confidentialite</loc>')
  })
})
