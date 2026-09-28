// /realisations (holding, DEC-39) et /{filiale}/realisations (6 filiales) — spec lot1 §1
// « Grille éditoriale », §5 T3. Contenu 100% depuis la base (REALISATIONS:entete, GET
// /api/public/sites/[slug]/realisations?limit=50) : aucune assertion sur un texte marketing écrit
// en dur ici. Boucle sur les 6 filiales + la holding (spec §0 : `/realisations` holding ne montre
// que les réalisations propres à la holding, pas un agrégat des filiales — vérifié par
// construction, l'API `/api/public/sites/holding/realisations` n'expose que ses propres lignes).
import { formatMoisAnnee } from '#shared/utils/dates'
import { REALISATIONS_MAX } from '#shared/config/public'
import { SITE_SLUGS, HOLDING_SLUG, type SiteSlug } from '#shared/config/sites'
import { test, expect, type Locator, type Page } from '@playwright/test'

const EXTERNAL_HOST_ALLOWLIST = ['localhost']

interface RealisationsEnteteDto {
  readonly titre: string
}
interface PublicRealisationDto {
  readonly uuid: string
  readonly titre: string
  readonly dateRealisation: string | null
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

function realisationsPath(slug: SiteSlug): string {
  return slug === HOLDING_SLUG ? '/realisations' : `/${slug}/realisations`
}

class RealisationsPage {
  constructor(private readonly page: Page) {}

  goto(slug: SiteSlug) {
    return this.page.goto(realisationsPath(slug))
  }

  get h1(): Locator {
    return this.page.getByRole('heading', { level: 1 })
  }

  get rows(): Locator {
    return this.page.locator('[role="list"] [role="listitem"]')
  }
}

test.describe('/realisations et /{filiale}/realisations — contenu public depuis la base (6 filiales + holding)', () => {
  test('should render a single H1, a grid count matching the API (limit=50) and formatted dates, with no external host request', async ({
    page,
    request,
  }) => {
    test.slow() // 7 sites x (2 appels API + 1 navigation) dans un seul test.

    for (const slug of SITE_SLUGS) {
      const externalRequests = trackExternalRequests(page)

      const [sections, realisations] = await Promise.all([
        request.get(`/api/public/sites/${slug}/sections?page=REALISATIONS`).then((r) => r.json()) as Promise<{
          entete?: RealisationsEnteteDto
        }>,
        request
          .get(`/api/public/sites/${slug}/realisations?limit=${REALISATIONS_MAX}`)
          .then((r) => r.json()) as Promise<PublicRealisationDto[]>,
      ])
      expect(sections.entete, `REALISATIONS:entete doit exister pour ${slug}`).toBeTruthy()

      const realisationsPage = new RealisationsPage(page)
      const response = await realisationsPage.goto(slug)
      expect(response?.status(), `GET ${realisationsPath(slug)} doit répondre 200`).toBe(200)

      await expect(realisationsPage.h1, `un seul H1 attendu sur ${realisationsPath(slug)}`).toHaveCount(1)
      await expect(realisationsPage.h1).toHaveText(sections.entete!.titre.replace(/\*/g, '').replace(/\n/g, ''))

      await expect(realisationsPage.rows, `nombre de réalisations affichées sur ${realisationsPath(slug)}`).toHaveCount(
        realisations.length,
      )

      for (const realisation of realisations) {
        await expect(
          page.getByRole('heading', { level: 2, name: realisation.titre }),
          `réalisation "${realisation.titre}" sur ${realisationsPath(slug)}`,
        ).toBeVisible()
        if (realisation.dateRealisation) {
          await expect(page.getByText(formatMoisAnnee(realisation.dateRealisation), { exact: true }).first()).toBeVisible()
        }
      }

      expect(
        externalRequests,
        `${realisationsPath(slug)} : requêtes vers un hôte externe détectées : ${externalRequests.join(', ')}`,
      ).toHaveLength(0)
    }
  })

  test('should return 404 for /holding (not a valid FilialeSlug at /{filiale}/realisations) and /inconnu/services', async ({ page }) => {
    const holdingFilialeResponse = await page.goto('/holding/realisations')
    expect(holdingFilialeResponse?.status()).toBe(404)

    const inconnuResponse = await page.goto('/inconnu/services')
    expect(inconnuResponse?.status()).toBe(404)
  })
})
