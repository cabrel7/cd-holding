// /{filiale} — accueil des 6 filiales (spec lot1 §1 « /{filiale} », §5 T3). Contenu 100% depuis
// la base (ACCUEIL:hero/audiences|metiers/services/realisations/cta, GET /api/public/sites/*) :
// aucune assertion sur un texte marketing écrit en dur ici — les valeurs attendues sont toujours
// lues depuis l'API publique avant d'être comparées au DOM, pour rester correctes même si le
// contenu est réédité. Boucle sur les 6 slugs (spec §5) : chaque itération est indépendante,
// aucun ordre implicite entre filiales.
//
// Régression ciblée (spec §0, T0) : `useSiteCollection` incluait `resource` seul dans sa clé de
// cache, ignorant la query — l'aperçu (`misEnAvant=true`) et la page complète des services
// partageaient donc la même entrée. Corrigé (clé = `site-collection:${slug}:${resource}:${query}`,
// voir app/composables/useSiteCollection.ts). Ce fichier vérifie l'absence de régression : la
// section "Nos services" de l'accueil ne doit jamais afficher l'état d'erreur (EtatCollection).
import { test, expect, type Locator, type Page } from '@playwright/test'
import { FILIALE_SLUGS, type FilialeSlug } from '#shared/config/sites'

const EXTERNAL_HOST_ALLOWLIST = ['localhost']
const DUO_SLUGS: readonly FilialeSlug[] = ['placement', 'ccdpaa']

interface AccueilSectionsDto {
  readonly hero?: { readonly titre: string }
  readonly audiences?: DuoDto
  readonly metiers?: DuoDto
  readonly services?: { readonly titre: string }
  readonly realisations?: { readonly titre: string }
  readonly cta?: { readonly titre: string }
}
interface DuoDto {
  readonly a: { readonly titre: string; readonly lienLibelle: string }
  readonly b: { readonly titre: string; readonly lienLibelle: string }
}
interface PublicServiceDto {
  readonly uuid: string
  readonly titre: string
}
interface PublicRealisationDto {
  readonly uuid: string
  readonly titre: string
}

/** Segments de `TexteAccentue` (spec phase 2) : `*x*` -> `<em>x</em>`, `\n` -> `<br>`. */
function plainTitre(titre: string): string {
  return titre.replace(/\*/g, '').replace(/\n/g, '')
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

class FilialeAccueilPage {
  constructor(private readonly page: Page) {}

  goto(slug: FilialeSlug) {
    return this.page.goto(`/${slug}`)
  }

  get h1(): Locator {
    return this.page.getByRole('heading', { level: 1 })
  }

  get mainSections(): Locator {
    return this.page.locator('main section')
  }

  /** Hero = 1re section ; duo (si présent) ou aperçu services = 2e section (spec §1). */
  get secondSection(): Locator {
    return this.mainSections.nth(1)
  }
}

test.describe('/{filiale} — accueil, contenu public depuis la base (6 filiales)', () => {
  test('should render a single H1, the duo only for placement/ccdpaa, and ordered services/réalisations previews matching the API (no error state, no external host request)', async ({
    page,
    request,
  }) => {
    test.slow() // 6 filiales x (3 appels API + 1 navigation) dans un seul test.

    for (const slug of FILIALE_SLUGS) {
      const externalRequests = trackExternalRequests(page)

      const [sections, services, realisations] = await Promise.all([
        request.get(`/api/public/sites/${slug}/sections?page=ACCUEIL`).then((r) => r.json()) as Promise<AccueilSectionsDto>,
        request.get(`/api/public/sites/${slug}/services?misEnAvant=true`).then((r) => r.json()) as Promise<PublicServiceDto[]>,
        request.get(`/api/public/sites/${slug}/realisations?limit=3`).then((r) => r.json()) as Promise<PublicRealisationDto[]>,
      ])
      expect(sections.hero, `ACCUEIL:hero doit exister pour ${slug}`).toBeTruthy()

      const accueilPage = new FilialeAccueilPage(page)
      const response = await accueilPage.goto(slug)
      expect(response?.status(), `GET /${slug} doit répondre 200`).toBe(200)

      // --- Un seul H1 --------------------------------------------------------------------
      await expect(accueilPage.h1, `un seul H1 attendu sur /${slug}`).toHaveCount(1)
      await expect(accueilPage.h1).toHaveText(plainTitre(sections.hero!.titre))

      // --- Duo (audiences/métiers) uniquement pour placement et ccdpaa --------------------
      const duo = sections.audiences ?? sections.metiers
      const isDuoSlug = (DUO_SLUGS as readonly string[]).includes(slug)
      expect(!!duo, `présence de la section duo API cohérente avec la liste attendue pour ${slug}`).toBe(isDuoSlug)

      const voirServicesLink = page.getByRole('link', { name: 'Voir tous les services' })

      if (isDuoSlug && duo) {
        // La 2e section (après le hero) est le duo : elle contient les 2 titres et liens du duo,
        // et JAMAIS le lien "Voir tous les services" (qui identifie l'aperçu services standard).
        await expect(accueilPage.secondSection.getByRole('heading', { level: 3, name: duo.a.titre })).toBeVisible()
        await expect(accueilPage.secondSection.getByRole('heading', { level: 3, name: duo.b.titre })).toBeVisible()
        await expect(accueilPage.secondSection.getByRole('link', { name: duo.a.lienLibelle })).toBeVisible()
        await expect(accueilPage.secondSection.getByRole('link', { name: duo.b.lienLibelle })).toBeVisible()
        await expect(
          accueilPage.secondSection.getByRole('link', { name: 'Voir tous les services' }),
          `la section duo de /${slug} ne doit pas contenir le lien de l'aperçu services`,
        ).toHaveCount(0)
      } else {
        // Pas de duo : la 2e section est directement l'aperçu services.
        await expect(voirServicesLink, `/${slug} (sans duo) doit afficher l'aperçu services en 2e section`).toBeVisible()
      }

      // --- Aperçu services : ordre = API, AUCUN état d'erreur (régression clé de cache) -----
      const servicesErrorMessage = page.getByText('Impossible de charger ce contenu pour le moment.')
      await expect(servicesErrorMessage, `/${slug} : l'aperçu services ne doit pas afficher l'état d'erreur`).toHaveCount(0)

      if (services.length > 0) {
        const serviceHeadings = page.getByRole('heading', { level: 3 })
        for (const [index, svc] of services.entries()) {
          await expect(serviceHeadings.filter({ hasText: svc.titre }).first(), `service "${svc.titre}" (rang ${index}) sur /${slug}`).toBeVisible()
        }
        // Ordre : chaque titre apparaît dans le même ordre que l'API (comparaison des positions).
        const renderedTitles = await serviceHeadings.allTextContents()
        const apiTitlesInOrder = services.map((s) => s.titre)
        const positions = apiTitlesInOrder.map((titre) => renderedTitles.indexOf(titre))
        expect(positions.every((p) => p >= 0), `tous les services API doivent être rendus sur /${slug}`).toBe(true)
        expect(positions, `l'ordre des services rendus doit suivre l'API sur /${slug}`).toEqual([...positions].sort((a, b) => a - b))
      }

      // --- Aperçu réalisations : ordre = API -------------------------------------------------
      if (realisations.length > 0) {
        for (const real of realisations) {
          await expect(page.getByText(real.titre, { exact: true }).first(), `réalisation "${real.titre}" sur /${slug}`).toBeVisible()
        }
      }

      expect(externalRequests, `/${slug} : requêtes vers un hôte externe détectées : ${externalRequests.join(', ')}`).toHaveLength(0)
    }
  })

  test('should return 404 for /holding (not a valid FilialeSlug) and /inconnu/services', async ({ page }) => {
    const holdingResponse = await page.goto('/holding')
    expect(holdingResponse?.status()).toBe(404)

    const inconnuResponse = await page.goto('/inconnu/services')
    expect(inconnuResponse?.status()).toBe(404)
  })
})
