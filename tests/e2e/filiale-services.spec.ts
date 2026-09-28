// /{filiale}/services — 6 filiales (spec lot1 §1 « /{filiale}/services », §5 T3). Contenu 100%
// depuis la base (SERVICES:entete/cta, GET /api/public/sites/[slug]/services) : aucune assertion
// sur un texte marketing écrit en dur ici. Boucle sur les 6 slugs, chaque itération indépendante.
// L'édition CMS restaure systématiquement l'état d'origine en try/finally (CLAUDE.md §Tests).
import { test, expect, type BrowserContext, type Locator, type Page } from '@playwright/test'
import { FILIALE_SLUGS } from '#shared/config/sites'
import { loginAs, SUPER_ADMIN } from './helpers/auth'

const EXTERNAL_HOST_ALLOWLIST = ['localhost']

interface PublicServiceDto {
  readonly uuid: string
  readonly titre: string
  readonly description: string
}

interface AdminServiceDto {
  readonly uuid: string
  readonly titre: string
  readonly site: { readonly slug: string }
}

function trackExternalRequests(page: Page): string[] {
  const externalRequests: string[] = []
  page.on('request', (req) => {
    const url = new URL(req.url())
    if (url.protocol.startsWith('http') && !EXTERNAL_HOST_ALLOWLIST.includes(url.hostname)) {
      externalRequests.push(req.url())
    }
  })
  return externalRequests
}

class FilialeServicesPage {
  constructor(private readonly page: Page) {}

  goto(slug: string) {
    return this.page.goto(`/${slug}/services`)
  }

  get h1(): Locator {
    return this.page.getByRole('heading', { level: 1 })
  }

  get rows(): Locator {
    return this.page.locator('[role="list"] [role="listitem"]')
  }
}

test.describe('/{filiale}/services — contenu public depuis la base (6 filiales)', () => {
  test('should render a single H1 and every service in API order, numbered 01..N, with no external host request (supermarchés present for entretien)', async ({
    page,
    request,
  }) => {
    test.slow() // 6 filiales x (1 appel API + 1 navigation) dans un seul test.

    for (const slug of FILIALE_SLUGS) {
      const externalRequests = trackExternalRequests(page)

      const services = (await request
        .get(`/api/public/sites/${slug}/services`)
        .then((r) => r.json())) as PublicServiceDto[]
      expect(services.length, `au moins un service doit être seedé pour ${slug}`).toBeGreaterThan(0)

      const servicesPage = new FilialeServicesPage(page)
      const response = await servicesPage.goto(slug)
      expect(response?.status(), `GET /${slug}/services doit répondre 200`).toBe(200)

      await expect(servicesPage.h1, `un seul H1 attendu sur /${slug}/services`).toHaveCount(1)

      await expect(servicesPage.rows, `nombre de rangées de service sur /${slug}/services`).toHaveCount(services.length)

      for (const [index, service] of services.entries()) {
        const numero = String(index + 1).padStart(2, '0')
        const row = servicesPage.rows.nth(index)
        await expect(row.getByRole('heading', { level: 2 }), `titre du service rang ${index} sur /${slug}/services`).toHaveText(
          service.titre,
        )
        // Le numéro peut apparaître deux fois (texte décoratif + repli aplat de l'image quand
        // `imageKey` est absent, `SiteImage :initiales="numero"`) : `.first()` suffit à prouver
        // sa présence sans imposer une unicité qui n'est pas un critère du lot.
        await expect(row.getByText(numero, { exact: true }).first(), `numéro "${numero}" sur /${slug}/services`).toBeVisible()
      }

      if (slug === 'entretien') {
        await expect(page.getByRole('heading', { level: 2, name: /supermarché/i })).toBeVisible()
      }

      expect(externalRequests, `/${slug}/services : requêtes vers un hôte externe détectées : ${externalRequests.join(', ')}`).toHaveLength(
        0,
      )
    }
  })

  test('should reflect an admin edit of a service title immediately (ISR invalidation), then restore it', async ({ browser }) => {
    const adminContext: BrowserContext = await browser.newContext()
    let target: AdminServiceDto | undefined
    let originalTitre: string | undefined

    try {
      await loginAs(adminContext, SUPER_ADMIN)
      const adminServices = (await adminContext.request
        .get('/api/admin/contenu/services?site=entretien')
        .then((r) => r.json())) as AdminServiceDto[]
      target = adminServices[0]
      expect(target, 'la filiale entretien doit avoir au moins un service seedé').toBeTruthy()
      originalTitre = target!.titre

      const marker = `Titre service modifié E2E${Date.now()}`
      const patch = await adminContext.request.patch(`/api/admin/contenu/services/${target!.uuid}`, {
        data: { titre: marker },
      })
      expect(patch.ok(), await patch.text()).toBeTruthy()

      const publicPage = await adminContext.newPage()
      // Navigation fraîche (pas de SPA) : preuve que la purge ISR a bien eu lieu.
      await publicPage.goto('/entretien/services')
      await expect(publicPage.getByRole('heading', { level: 2, name: marker })).toBeVisible()
      await publicPage.close()
    } finally {
      if (target && originalTitre !== undefined) {
        const restorePatch = await adminContext.request.patch(`/api/admin/contenu/services/${target.uuid}`, {
          data: { titre: originalTitre },
        })
        if (restorePatch.ok()) {
          const restorePage = await adminContext.newPage()
          await restorePage.goto('/entretien/services')
          await expect(restorePage.getByRole('heading', { level: 2, name: originalTitre })).toBeVisible()
          await restorePage.close()
        }
      }
      await adminContext.close()
    }
  })

  test('should return 404 for /holding/services (holding is not a FilialeSlug) and /inconnu/services', async ({ page }) => {
    const holdingResponse = await page.goto('/holding/services')
    expect(holdingResponse?.status()).toBe(404)

    const inconnuResponse = await page.goto('/inconnu/services')
    expect(inconnuResponse?.status()).toBe(404)
  })
})
