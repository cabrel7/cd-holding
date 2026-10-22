import { describe, expect, it } from 'vitest'
import { MODULES, SITE_MODULES, siteHasModule } from '#shared/config/modules'
import { SITE_SLUGS } from '#shared/config/sites'

describe('SITE_MODULES', () => {
  it('should have an entry for every site slug', () => {
    for (const slug of SITE_SLUGS) {
      expect(SITE_MODULES[slug]).toBeDefined()
    }
  })

  it('should give holding and boissons no module', () => {
    expect(SITE_MODULES.holding).toEqual([])
    expect(SITE_MODULES.boissons).toEqual([])
  })

  it('should give cdpaa both planning and reservations', () => {
    expect(SITE_MODULES.cdpaa).toEqual([MODULES.PLANNING, MODULES.RESERVATIONS])
  })
})

describe('siteHasModule', () => {
  it('should be true for entretien + planning', () => {
    expect(siteHasModule('entretien', MODULES.PLANNING)).toBe(true)
  })

  it('should be false for entretien + comptable', () => {
    expect(siteHasModule('entretien', MODULES.COMPTABLE)).toBe(false)
  })

  it('should be true for comptable + comptable', () => {
    expect(siteHasModule('comptable', MODULES.COMPTABLE)).toBe(true)
  })

  it('should be false for holding + any module', () => {
    for (const module of Object.values(MODULES)) {
      expect(siteHasModule('holding', module)).toBe(false)
    }
  })
})
