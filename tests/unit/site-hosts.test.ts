import { describe, expect, it } from 'vitest'
import { hoteDeSlug, parseSiteHost, SITE_HOSTS } from '#shared/config/site-hosts'

describe('SITE_HOSTS', () => {
  it('should map 9 hosts: apex + www to holding, 6 filiales, admin', () => {
    expect(Object.keys(SITE_HOSTS)).toHaveLength(9)
    expect(SITE_HOSTS['chauvierdelor.com']).toBe('holding')
    expect(SITE_HOSTS['www.chauvierdelor.com']).toBe('holding')
    expect(SITE_HOSTS['admin.chauvierdelor.com']).toBe('admin')
    for (const filiale of ['entretien', 'transport', 'comptable', 'placement', 'ccdpaa', 'boissons']) {
      expect(SITE_HOSTS[`${filiale}.chauvierdelor.com`]).toBe(filiale)
    }
  })
})

describe('parseSiteHost', () => {
  it.each([
    ['chauvierdelor.com', 'chemin', 'holding'],
    ['www.chauvierdelor.com', 'chemin', 'holding'],
    ['entretien.chauvierdelor.com', 'sous-domaine', 'entretien'],
    ['boissons.chauvierdelor.com', 'sous-domaine', 'boissons'],
    ['admin.chauvierdelor.com', 'sous-domaine', 'admin'],
  ])('should resolve prod host %s', (host, mode, slug) => {
    expect(parseSiteHost(host)).toEqual({ mode, slug, hoteConnu: true })
  })

  it('should strip port and be case-insensitive', () => {
    expect(parseSiteHost('Entretien.ChauvierDelor.com:443')).toEqual({
      mode: 'sous-domaine',
      slug: 'entretien',
      hoteConnu: true,
    })
  })

  it('should resolve *.localhost test hosts without marking them known', () => {
    expect(parseSiteHost('entretien.localhost:3000')).toEqual({
      mode: 'sous-domaine',
      slug: 'entretien',
      hoteConnu: false,
    })
    expect(parseSiteHost('chauvierdelor.com.localhost')).toEqual({
      mode: 'chemin',
      slug: 'holding',
      hoteConnu: false,
    })
  })

  it('should fall back to path mode for unknown hosts (dev, IP)', () => {
    expect(parseSiteHost('127.0.0.1:3000')).toEqual({ mode: 'chemin', hoteConnu: false })
    expect(parseSiteHost('inconnu.example')).toEqual({ mode: 'chemin', hoteConnu: false })
    expect(parseSiteHost('unknown.localhost')).toEqual({ mode: 'chemin', hoteConnu: false })
  })
})

describe('hoteDeSlug', () => {
  it('should return the canonical FQDN for each slug', () => {
    expect(hoteDeSlug('holding')).toBe('chauvierdelor.com')
    expect(hoteDeSlug('entretien')).toBe('entretien.chauvierdelor.com')
    expect(hoteDeSlug('admin')).toBe('admin.chauvierdelor.com')
  })

  it('should return undefined for unknown slugs', () => {
    expect(hoteDeSlug('inconnu' as never)).toBeUndefined()
  })
})
