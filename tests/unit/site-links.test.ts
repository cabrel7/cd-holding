import { describe, expect, it } from 'vitest'
import {
  adminHref,
  canonicalPath,
  cibleRedirection,
  siteAbsoluteUrl,
  siteHref,
  type ContexteSite,
} from '#shared/utils/site-links'

const ORIGINE = 'https://chauvierdelor.com'

const cheminDev: ContexteSite = { mode: 'chemin', hote: undefined, hoteConnu: false }
const apexProd: ContexteSite = { mode: 'chemin', hote: 'holding', hoteConnu: true, origine: ORIGINE }
const entretienProd: ContexteSite = {
  mode: 'sous-domaine',
  hote: 'entretien',
  hoteConnu: true,
  origine: 'https://entretien.chauvierdelor.com',
}
const entretienTest: ContexteSite = { mode: 'sous-domaine', hote: 'entretien', hoteConnu: false }

describe('siteHref — même site', () => {
  it('should prefix in chemin mode (apex holding)', () => {
    expect(siteHref(apexProd, 'holding', '/a-propos')).toEqual({ to: '/a-propos', externe: false })
    expect(siteHref(cheminDev, 'entretien', '/services')).toEqual({
      to: '/entretien/services',
      externe: false,
    })
  })

  it('should be bare in sous-domaine mode', () => {
    expect(siteHref(entretienProd, 'entretien', '/services')).toEqual({ to: '/services', externe: false })
    expect(siteHref(entretienTest, 'entretien', '/contact')).toEqual({ to: '/contact', externe: false })
    expect(siteHref(apexProd, 'holding', '/')).toEqual({ to: '/', externe: false })
  })

  it('should keep nav root a bare / on the filiale subdomain', () => {
    expect(siteHref(entretienProd, 'entretien', '/').to).toBe('/')
  })
})

describe('siteHref — site différent', () => {
  it('should stay relative-prefixed in dev (SPA, suite e2e inchangée)', () => {
    expect(siteHref(cheminDev, 'holding', '/a-propos')).toEqual({ to: '/a-propos', externe: false })
    expect(siteHref(cheminDev, 'transport', '/services')).toEqual({
      to: '/transport/services',
      externe: false,
    })
    expect(siteHref(entretienTest, 'ccdpaa', '/restaurant')).toEqual({
      to: '/ccdpaa/restaurant',
      externe: false,
    })
  })

  it('should be absolute on the target host in prod', () => {
    expect(siteHref(apexProd, 'entretien', '/services')).toEqual({
      to: 'https://entretien.chauvierdelor.com/services',
      externe: true,
    })
    expect(siteHref(entretienProd, 'holding', '/a-propos')).toEqual({
      to: 'https://chauvierdelor.com/a-propos',
      externe: true,
    })
    expect(siteHref(entretienProd, 'admin', '/admin/messages').to).toBe(
      'https://admin.chauvierdelor.com/messages',
    )
  })
})

describe('siteHref — chemins partagés et hash', () => {
  it('should serve /confidentialite bare on every host', () => {
    expect(siteHref(apexProd, 'holding', '/confidentialite').to).toBe('/confidentialite')
    expect(siteHref(entretienProd, 'entretien', '/confidentialite').to).toBe('/confidentialite')
    expect(siteHref(cheminDev, 'entretien', '/confidentialite').to).toBe('/confidentialite')
  })

  it('should append hash (with or without #)', () => {
    expect(siteHref(apexProd, 'holding', '/', '#filiales').to).toBe('/#filiales')
    expect(siteHref(entretienProd, 'entretien', '/services', 'haut').to).toBe('/services#haut')
  })

  it('should accept paths without leading slash', () => {
    expect(siteHref(cheminDev, 'entretien', 'services').to).toBe('/entretien/services')
  })
})

describe('siteAbsoluteUrl', () => {
  it('should return the bare canonical form on the target host', () => {
    expect(siteAbsoluteUrl(ORIGINE, 'entretien', '/offres/abc')).toBe(
      'https://entretien.chauvierdelor.com/offres/abc',
    )
    expect(siteAbsoluteUrl(ORIGINE, 'holding', '/')).toBe('https://chauvierdelor.com/')
    expect(siteAbsoluteUrl('https://placement.chauvierdelor.com', 'placement', '/offres')).toBe(
      'https://placement.chauvierdelor.com/offres',
    )
  })
})

describe('adminHref', () => {
  it('should keep /admin prefix outside the admin host', () => {
    expect(adminHref('/admin/messages', false)).toBe('/admin/messages')
    expect(adminHref('/admin', false)).toBe('/admin')
  })

  it('should strip /admin on the admin host (bare paths)', () => {
    expect(adminHref('/admin', true)).toBe('/')
    expect(adminHref('/admin/contenu/site/x', true)).toBe('/contenu/site/x')
    expect(adminHref('/admin/mon-planning', true)).toBe('/mon-planning')
  })

  it('should pass non-admin paths through', () => {
    expect(adminHref('/confidentialite', true)).toBe('/confidentialite')
  })
})

describe('canonicalPath', () => {
  it('should return null when host unknown (dev)', () => {
    expect(canonicalPath('/entretien/services', cheminDev)).toBeNull()
  })

  it('should strip the own slug prefix on a known subdomain (server path is prefixed)', () => {
    expect(canonicalPath('/entretien/services', entretienProd)).toBe('/services')
    expect(canonicalPath('/entretien', entretienProd)).toBe('/')
  })

  it('should keep the path as-is on apex and for other sites', () => {
    expect(canonicalPath('/a-propos', apexProd)).toBe('/a-propos')
    expect(canonicalPath('/', apexProd)).toBe('/')
    expect(canonicalPath('/transport/services', entretienProd)).toBe('/transport/services')
  })
})

describe('cibleRedirection', () => {
  it('should redirect nothing on unknown hosts (dev)', () => {
    expect(cibleRedirection('localhost:3000', '/entretien/services')).toBeNull()
    expect(cibleRedirection('127.0.0.1', '/admin')).toBeNull()
  })

  it('should strip prefixed filiale paths on the apex to the subdomain', () => {
    expect(cibleRedirection('chauvierdelor.com', '/entretien/services', ORIGINE)).toBe(
      'https://entretien.chauvierdelor.com/services',
    )
    expect(cibleRedirection('www.chauvierdelor.com', '/ccdpaa', ORIGINE)).toBe(
      'https://ccdpaa.chauvierdelor.com/',
    )
    expect(cibleRedirection('chauvierdelor.com', '/entretien/services?x=1', ORIGINE)).toBe(
      'https://entretien.chauvierdelor.com/services?x=1',
    )
  })

  it('should send /admin and /admin/... from apex to the admin host', () => {
    expect(cibleRedirection('chauvierdelor.com', '/admin', ORIGINE)).toBe(
      'https://admin.chauvierdelor.com/',
    )
    expect(cibleRedirection('chauvierdelor.com', '/admin/messages', ORIGINE)).toBe(
      'https://admin.chauvierdelor.com/messages',
    )
  })

  it('should strip an already-prefixed path on the filiale subdomain (anti-boucle)', () => {
    expect(
      cibleRedirection('entretien.chauvierdelor.com', '/entretien/services', ORIGINE),
    ).toBe('/services')
    expect(cibleRedirection('entretien.chauvierdelor.com', '/entretien', ORIGINE)).toBe('/')
  })

  it('should strip /admin on the admin host and pass bare paths through', () => {
    expect(cibleRedirection('admin.chauvierdelor.com', '/admin/messages', ORIGINE)).toBe('/messages')
    expect(cibleRedirection('admin.chauvierdelor.com', '/admin', ORIGINE)).toBe('/')
    expect(cibleRedirection('admin.chauvierdelor.com', '/messages', ORIGINE)).toBeNull()
    expect(cibleRedirection('admin.chauvierdelor.com', '/confidentialite', ORIGINE)).toBeNull()
  })

  it('should preserve the query on exact-match root branches (revue m1)', () => {
    expect(cibleRedirection('admin.chauvierdelor.com', '/admin?x=1', ORIGINE)).toBe('/?x=1')
    expect(cibleRedirection('entretien.chauvierdelor.com', '/entretien?utm=a', ORIGINE)).toBe('/?utm=a')
  })

  it('should pass non-concerned paths on the apex (/, /a-propos, /services)', () => {
    expect(cibleRedirection('chauvierdelor.com', '/', ORIGINE)).toBeNull()
    expect(cibleRedirection('chauvierdelor.com', '/a-propos', ORIGINE)).toBeNull()
    expect(cibleRedirection('chauvierdelor.com', '/services', ORIGINE)).toBeNull()
  })

  it('should pass bare paths on the filiale subdomain (the normal case)', () => {
    expect(cibleRedirection('entretien.chauvierdelor.com', '/services', ORIGINE)).toBeNull()
    expect(cibleRedirection('entretien.chauvierdelor.com', '/transport/services', ORIGINE)).toBeNull()
  })
})
