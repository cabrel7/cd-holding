// Gabarit e2e (spec phase 2 §4.8 : "sert de gabarit pour la phase 3") — accent de marque par
// filiale sur les 7 pages /a-propos (holding + 6 filiales). Lecture seule : aucune donnée n'est
// modifiée, le test tourne donc sur les 3 largeurs (375/768/1440, voir playwright.config.ts).
import { test, expect, type Locator, type Page } from '@playwright/test'
import { SITE_ACCENTS, hexToRgb } from './fixtures/accents'

const PAGES: ReadonlyArray<{ slug: string; path: string }> = [
  { slug: 'holding', path: '/a-propos' },
  { slug: 'entretien', path: '/entretien/a-propos' },
  { slug: 'transport', path: '/transport/a-propos' },
  { slug: 'comptable', path: '/comptable/a-propos' },
  { slug: 'placement', path: '/placement/a-propos' },
  { slug: 'ccdpaa', path: '/ccdpaa/a-propos' },
  { slug: 'boissons', path: '/boissons/a-propos' },
]

/**
 * Le CTA "Nous joindre" du header n'est visible que dans la nav desktop (`hidden md:flex`,
 * SiteHeader.vue) sauf si le menu mobile est ouvert. En dessous de 768px, on ouvre le menu pour
 * révéler une copie visible du même lien plutôt que de dupliquer la logique par breakpoint.
 */
async function revealNavCta(page: Page): Promise<Locator> {
  const links = page.getByRole('link', { name: 'Nous joindre' })
  const desktopLink = links.first()
  if (await desktopLink.isVisible()) return desktopLink

  await page.getByRole('button', { name: 'Menu' }).click()
  const count = await links.count()
  for (let i = 0; i < count; i += 1) {
    const candidate = links.nth(i)
    if (await candidate.isVisible()) return candidate
  }
  throw new Error('CTA "Nous joindre" introuvable après ouverture du menu mobile')
}

async function anyVisible(locator: Locator): Promise<boolean> {
  const count = await locator.count()
  for (let i = 0; i < count; i += 1) {
    if (await locator.nth(i).isVisible()) return true
  }
  return false
}

test.describe('Accent de navigation par filiale — /a-propos (7 sites)', () => {
  for (const { slug, path } of PAGES) {
    test(`should apply the ${slug} brand accent to the layout and CTA on ${path}`, async ({ page }) => {
      const response = await page.goto(path)
      expect(response?.status()).toBe(200)

      const wrapper = page.locator(`[data-site="${slug}"]`)
      await expect(wrapper).toBeVisible()

      const accentVar = await wrapper.evaluate((el) => getComputedStyle(el).getPropertyValue('--site-accent').trim())
      expect(accentVar.toUpperCase()).toBe(SITE_ACCENTS[slug])

      const cta = await revealNavCta(page)
      const backgroundColor = await cta.evaluate((el) => getComputedStyle(el).backgroundColor)
      expect(backgroundColor).toBe(hexToRgb(SITE_ACCENTS[slug]))

      // "Restaurant" et "Offres" : présents uniquement dans la nav des filiales concernées
      // (shared/config/sites.ts publicNav) — jamais ailleurs, quel que soit l'état du menu.
      const restaurantCount = await page.getByRole('link', { name: 'Restaurant' }).count()
      const offresCount = await page.getByRole('link', { name: 'Offres' }).count()

      if (slug === 'ccdpaa') {
        expect(restaurantCount).toBeGreaterThan(0)
        await expect.poll(() => anyVisible(page.getByRole('link', { name: 'Restaurant' }))).toBe(true)
      } else {
        expect(restaurantCount).toBe(0)
      }

      if (slug === 'placement') {
        expect(offresCount).toBeGreaterThan(0)
        await expect.poll(() => anyVisible(page.getByRole('link', { name: 'Offres' }))).toBe(true)
      } else {
        expect(offresCount).toBe(0)
      }
    })
  }

  test('should reveal the navigation through the mobile menu toggle (aria-expanded)', async ({ page }) => {
    const viewport = page.viewportSize()
    test.skip(!viewport || viewport.width >= 768, 'Le bouton menu est masqué (md:hidden) à partir de 768px')

    await page.goto('/entretien/a-propos')
    const toggle = page.getByRole('button', { name: 'Menu' })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(toggle).toHaveAttribute('aria-controls', 'site-mobile-nav')

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator('#site-mobile-nav')).toBeVisible()
    await expect(page.locator('#site-mobile-nav').getByRole('link', { name: 'Services' })).toBeVisible()

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
})
