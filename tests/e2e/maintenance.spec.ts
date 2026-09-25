// Mode maintenance d'une filiale (spec phase 2 §4.3 DEC-09, §4.9 point 7). Seul SUPER_ADMIN
// pilote `statutSite` (point ouvert #1). Restauration systématique en `afterAll`, même si une
// assertion échoue en cours de route, pour ne jamais laisser un site de démo en maintenance.
import { test, expect, type APIRequestContext, type BrowserContext } from '@playwright/test'
import { loginAs, SUPER_ADMIN } from './helpers/auth'

const FILIALE_SLUG = 'entretien'

async function setStatutSite(request: APIRequestContext, uuid: string, statutSite: 'ACTIF' | 'EN_MAINTENANCE'): Promise<void> {
  const response = await request.patch(`/api/admin/sites/${uuid}`, { data: { statutSite } })
  if (!response.ok()) {
    throw new Error(`PATCH /api/admin/sites/${uuid} a échoué (${response.status()}) en visant statutSite=${statutSite}`)
  }
}

test.describe('Mode maintenance d\'une filiale', () => {
  let adminContext: BrowserContext
  let filialeUuid: string

  test.beforeAll(async ({ browser }) => {
    adminContext = await browser.newContext()
    await loginAs(adminContext, SUPER_ADMIN)
    const sites = await adminContext.request.get('/api/admin/sites').then((r) => r.json())
    const filiale = (sites as Array<{ uuid: string; slug: string }>).find((s) => s.slug === FILIALE_SLUG)
    if (!filiale) throw new Error(`Filiale ${FILIALE_SLUG} introuvable via GET /api/admin/sites`)
    filialeUuid = filiale.uuid
  })

  // Filet de sécurité : si le test échoue en cours de route, la filiale ne doit jamais rester
  // en maintenance pour les runs suivants (ou pour un humain qui visiterait le site après coup).
  test.afterAll(async () => {
    await setStatutSite(adminContext.request, filialeUuid, 'ACTIF')
    await adminContext.close()
  })

  test('should serve 503 with noindex and no navigation while in maintenance, then return to 200', async ({ page }) => {
    await setStatutSite(adminContext.request, filialeUuid, 'EN_MAINTENANCE')

    const response = await page.goto(`/${FILIALE_SLUG}/a-propos`)
    expect(response?.status()).toBe(503)

    const robots = await page.locator('meta[name="robots"]').getAttribute('content')
    expect(robots).toContain('noindex')

    // Page de maintenance affichée à la place du contenu, sans navigation (header sans nav,
    // spec §4.3) : ni lien de nav, ni bouton menu mobile.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Retour au Groupe CD' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Services' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Menu' })).toHaveCount(0)

    await setStatutSite(adminContext.request, filialeUuid, 'ACTIF')

    const restored = await page.goto(`/${FILIALE_SLUG}/a-propos`)
    expect(restored?.status()).toBe(200)
    // Hors maintenance, `useSeoMeta({ robots: 'noindex' })` n'est jamais appelé : la balise
    // n'existe simplement plus dans le head (pas de contenu résiduel à vérifier).
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Services' })).toBeVisible()
  })

  test('should not affect a sibling filiale while one is in maintenance', async ({ page }) => {
    await setStatutSite(adminContext.request, filialeUuid, 'EN_MAINTENANCE')

    const response = await page.goto('/transport/a-propos')
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('link', { name: 'Services' })).toBeVisible()

    await setStatutSite(adminContext.request, filialeUuid, 'ACTIF')
  })
})
