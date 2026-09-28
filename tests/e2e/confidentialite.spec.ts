// /confidentialite — holding (spec lot1 §1 « /confidentialite », §5 T3). `bypassMaintenance:
// true` (app/pages/confidentialite.vue) : la politique doit rester lisible même en maintenance de
// la holding (Loi 25, liens depuis les formulaires) — vérifié ici en mettant réellement la holding
// EN_MAINTENANCE, puis en restaurant `ACTIF` en `afterAll` (filet de sécurité, comme
// maintenance.spec.ts) même si une assertion échoue en cours de route.
import { test, expect, type BrowserContext, type Locator, type Page } from '@playwright/test'
import { HOLDING_SLUG } from '#shared/config/sites'
import { loginAs, SUPER_ADMIN } from './helpers/auth'

const EXTERNAL_HOST_ALLOWLIST = ['localhost']

interface LegalSectionDto {
  readonly titre: string
  readonly paragraphes: readonly string[]
}
interface PolitiqueDto {
  readonly titre: string
  readonly sections: readonly LegalSectionDto[]
}
interface AdminSiteSummaryDto {
  readonly uuid: string
  readonly slug: string
}
interface PublicSiteDto {
  readonly groupe: { readonly nom: string }
}

// Interpolation locale (miroir minimal de shared/utils/texte.ts, comme dans contact.spec.ts) :
// seule la variable {groupe} est utilisée par ce contenu légal.
function interpolerGroupe(texte: string, groupe: string): string {
  return texte.replace(/\{groupe\}/g, groupe)
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

class ConfidentialitePage {
  constructor(private readonly page: Page) {}

  goto() {
    return this.page.goto('/confidentialite')
  }

  get h1(): Locator {
    return this.page.getByRole('heading', { level: 1 })
  }
}

async function setHoldingStatut(request: BrowserContext['request'], uuid: string, statutSite: 'ACTIF' | 'EN_MAINTENANCE'): Promise<void> {
  const response = await request.patch(`/api/admin/sites/${uuid}`, { data: { statutSite } })
  if (!response.ok()) {
    throw new Error(`PATCH /api/admin/sites/${uuid} a échoué (${response.status()}) en visant statutSite=${statutSite}`)
  }
}

test.describe('/confidentialite — holding, contenu public depuis la base', () => {
  test('should render a single H1 and every section/paragraph matching CONFIDENTIALITE:politique, with no external host request', async ({
    page,
    request,
  }) => {
    const [sections, site] = await Promise.all([
      request.get('/api/public/sites/holding/sections?page=CONFIDENTIALITE').then((r) => r.json()) as Promise<{
        politique?: PolitiqueDto
      }>,
      request.get('/api/public/sites/holding').then((r) => r.json()) as Promise<PublicSiteDto>,
    ])
    expect(sections.politique, 'CONFIDENTIALITE:politique doit exister').toBeTruthy()
    const politique = sections.politique!
    const groupe = site.groupe.nom

    const externalRequests = trackExternalRequests(page)
    const confidentialitePage = new ConfidentialitePage(page)
    const response = await confidentialitePage.goto()
    expect(response?.status()).toBe(200)

    await expect(confidentialitePage.h1).toHaveCount(1)
    await expect(confidentialitePage.h1).toHaveText(interpolerGroupe(politique.titre, groupe).replace(/\*/g, '').replace(/\n/g, ''))

    for (const section of politique.sections) {
      await expect(page.getByRole('heading', { level: 2, name: interpolerGroupe(section.titre, groupe) })).toBeVisible()
      for (const paragraphe of section.paragraphes) {
        await expect(page.getByText(interpolerGroupe(paragraphe, groupe), { exact: true }).first()).toBeVisible()
      }
    }

    expect(externalRequests, `Requêtes vers un hôte externe détectées : ${externalRequests.join(', ')}`).toHaveLength(0)
  })

  test.describe('pendant une maintenance de la holding', () => {
    let adminContext: BrowserContext
    let holdingUuid: string

    test.beforeAll(async ({ browser }) => {
      adminContext = await browser.newContext()
      await loginAs(adminContext, SUPER_ADMIN)
      const sites = (await adminContext.request.get('/api/admin/sites').then((r) => r.json())) as AdminSiteSummaryDto[]
      const holding = sites.find((s) => s.slug === HOLDING_SLUG)
      if (!holding) throw new Error('La holding doit être seedée et visible via GET /api/admin/sites')
      holdingUuid = holding.uuid
    })

    // Filet de sécurité : si le test échoue en cours de route, la holding ne doit jamais rester
    // en maintenance pour les runs suivants (ou pour un humain qui visiterait le site après coup).
    test.afterAll(async () => {
      await setHoldingStatut(adminContext.request, holdingUuid, 'ACTIF')
      await adminContext.close()
    })

    test('should still return 200 on /confidentialite while the holding is EN_MAINTENANCE', async ({ page }) => {
      await setHoldingStatut(adminContext.request, holdingUuid, 'EN_MAINTENANCE')

      const confidentialitePage = new ConfidentialitePage(page)
      const response = await confidentialitePage.goto()
      expect(response?.status(), '/confidentialite doit rester en 200 même holding EN_MAINTENANCE (bypassMaintenance)').toBe(200)
      await expect(confidentialitePage.h1).toBeVisible()

      await setHoldingStatut(adminContext.request, holdingUuid, 'ACTIF')

      const restored = await confidentialitePage.goto()
      expect(restored?.status()).toBe(200)
    })
  })

  test('should return 404 for /holding (not a valid FilialeSlug at /{filiale}) and /inconnu/services', async ({ page }) => {
    const holdingResponse = await page.goto('/holding')
    expect(holdingResponse?.status()).toBe(404)

    const inconnuResponse = await page.goto('/inconnu/services')
    expect(inconnuResponse?.status()).toBe(404)
  })
})
