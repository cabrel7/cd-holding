// / — accueil holding (spec phase 3 §6, critères 1 à 10). Contenu 100% depuis la base
// (ACCUEIL:hero/filiales/chiffres/cta, GET /api/public/sites) : aucune assertion sur un texte
// marketing écrit en dur ici — les valeurs attendues sont toujours lues depuis l'API publique
// (ou admin pour le critère 6) avant d'être comparées au DOM, pour rester correctes même si
// le contenu est réédité (spec §2.3, §6). Chaque test est indépendant (pas d'ordre implicite).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect, type Locator, type Page } from '@playwright/test'
import { loginAs, SUPER_ADMIN } from './helpers/auth'
import { hexToRgb } from './fixtures/accents'

const EXTERNAL_HOST_ALLOWLIST = ['localhost']
const LG_BREAKPOINT_PX = 1024

interface PublicSiteSummaryDto {
  readonly uuid: string
  readonly slug: string
  readonly nom: string
  readonly secteur: string | null
  readonly description: string | null
  readonly couleurAccent: string
  readonly heroImageKey: string | null
  readonly statutSite: string
}

interface PublicSiteDto {
  readonly heroImageKey: string | null
}

interface HeroDonnees {
  readonly titre: string
  readonly ctaLibelle?: string
  readonly badgeLibelle?: string
  readonly imageKey?: string | null
}

interface SectionDonnees {
  readonly titre: string
}

interface ChiffreResoluDonnees {
  readonly valeur: string
  readonly libelle: string
}

interface ChiffresDonnees {
  readonly items: readonly ChiffreResoluDonnees[]
}

interface CtaDonnees {
  readonly titre: string
  readonly ctaLibelle: string
}

interface AccueilSections {
  readonly hero?: HeroDonnees
  readonly filiales?: SectionDonnees
  readonly chiffres?: ChiffresDonnees
  readonly cta?: CtaDonnees
}

interface AdminSectionRow {
  readonly uuid: string
  readonly page: string
  readonly cle: string
  readonly donnees: Record<string, unknown>
}

/** Segments de `TexteAccentue` (spec phase 2) : `*x*` -> `<em>x</em>`, `\n` -> `<br>` (aucun texte). */
function parseAccentTitre(titre: string): { plain: string; lineBreaks: number; accentText: string | null } {
  const accentMatch = titre.match(/\*(.+?)\*/)
  return {
    plain: titre.replace(/\*/g, '').replace(/\n/g, ''),
    lineBreaks: titre.split('\n').length - 1,
    accentText: accentMatch ? accentMatch[1] : null,
  }
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

/** Le lien "Nos filiales" du header est masqué (`hidden md:flex`) sous 768px sauf menu ouvert. */
async function revealHeaderLink(page: Page, name: string): Promise<Locator> {
  const links = page.getByRole('link', { name })
  const desktopLink = links.first()
  if (await desktopLink.isVisible()) return desktopLink

  await page.getByRole('button', { name: 'Menu' }).click()
  const count = await links.count()
  for (let i = 0; i < count; i += 1) {
    const candidate = links.nth(i)
    if (await candidate.isVisible()) return candidate
  }
  throw new Error(`Lien "${name}" introuvable après ouverture du menu mobile`)
}

// --- Page Object ---------------------------------------------------------------------------
class HomePage {
  constructor(private readonly page: Page) {}

  goto() {
    return this.page.goto('/')
  }

  get h1(): Locator {
    return this.page.getByRole('heading', { level: 1 })
  }

  get filialesSection(): Locator {
    return this.page.locator('#filiales')
  }

  get filialesHeading(): Locator {
    return this.filialesSection.getByRole('heading', { level: 2 })
  }

  get filialesRows(): Locator {
    return this.filialesSection.locator('ol > li')
  }

  get heroSection(): Locator {
    return this.page.locator('main section').first()
  }

  get finalCtaSection(): Locator {
    // `section` seul matcherait aussi la région de notifications vue-sonner (`aria-label="Notifications
    // alt+T"`, téléportée en fin de <body>) : on scope au `<main>` de la page.
    return this.page.locator('main section').last()
  }
}

test.describe('/ — accueil holding, contenu public depuis la base', () => {
  test('should render a single H1 from ACCUEIL:hero.titre (accent in <em>, \\n as <br>) with no external host request', async ({
    page,
    request,
  }) => {
    const externalRequests = trackExternalRequests(page)
    const sections = (await request
      .get('/api/public/sites/holding/sections?page=ACCUEIL')
      .then((r) => r.json())) as AccueilSections
    expect(sections.hero, 'ACCUEIL:hero doit exister').toBeTruthy()
    const parsed = parseAccentTitre(sections.hero!.titre)

    const homePage = new HomePage(page)
    const response = await homePage.goto()
    expect(response?.status()).toBe(200)

    await expect(homePage.h1).toHaveCount(1)
    await expect(homePage.h1).toHaveText(parsed.plain)
    if (parsed.lineBreaks > 0) {
      await expect(homePage.h1.locator('br')).toHaveCount(parsed.lineBreaks)
    }
    if (parsed.accentText) {
      await expect(homePage.h1.locator('em')).toHaveText(parsed.accentText)
    }

    expect(externalRequests, `Requêtes vers un hôte externe détectées : ${externalRequests.join(', ')}`).toHaveLength(0)
  })

  test('should list filiales in the order of GET /api/public/sites, numbered 01-N, with correct links and per-row accent', async ({
    page,
    request,
  }) => {
    const filiales = (await request.get('/api/public/sites').then((r) => r.json())) as PublicSiteSummaryDto[]
    expect(filiales.length, 'au moins une filiale doit être seedée').toBeGreaterThan(0)

    const homePage = new HomePage(page)
    await homePage.goto()

    await expect(homePage.filialesRows).toHaveCount(filiales.length)

    for (const [index, filiale] of filiales.entries()) {
      const row = homePage.filialesRows.nth(index)
      const numero = String(index + 1).padStart(2, '0')

      await expect(row.getByText(numero, { exact: true })).toBeVisible()
      await expect(row.getByRole('heading', { level: 3 })).toHaveText(filiale.nom)

      const link = row.getByRole('link', { name: `Découvrir cette filiale : ${filiale.nom}` })
      await expect(link).toHaveAttribute('href', `/${filiale.slug}`)

      if (filiale.secteur) {
        const secteurLocator = row.getByText(filiale.secteur, { exact: true })
        await expect(secteurLocator).toBeVisible()

        // Le petit texte de secteur utilise `--site-accent-strong` (assombri), jamais l'accent
        // brut de la filiale directement (spec §4.2, WCAG AA) — sinon même couleur exacte.
        const secteurColor = await secteurLocator.evaluate((el) => getComputedStyle(el).color)
        expect(secteurColor).not.toBe(hexToRgb(filiale.couleurAccent))
      }
      if (filiale.description) {
        await expect(row.getByText(filiale.description, { exact: true })).toBeVisible()
      }

      const accentVar = await row.evaluate((el) => getComputedStyle(el).getPropertyValue('--site-accent').trim())
      expect(accentVar.toUpperCase()).toBe(filiale.couleurAccent.toUpperCase())
    }
  })

  test('should fix the header "Nos filiales" anchor (/#filiales, no more "##") and scroll under the fixed header on click', async ({
    page,
  }) => {
    const homePage = new HomePage(page)
    await homePage.goto()

    const link = await revealHeaderLink(page, 'Nos filiales')
    await expect(link).toHaveAttribute('href', '/#filiales')
    await link.click()

    await expect(page).toHaveURL(/\/#filiales$/)

    // Attend la fin du défilement (natif, potentiellement animé) avant de mesurer les positions.
    await expect
      .poll(
        async () => {
          const box = await homePage.filialesSection.boundingBox()
          // `boundingBox()` renvoie {x, y, width, height} (pas {top, left}) — `y` est la
          // coordonnée verticale relative au viewport, équivalente à `getBoundingClientRect().top`.
          return box ? Math.round(box.y) : null
        },
        { message: 'La section #filiales doit se stabiliser près du haut de la fenêtre après le défilement' },
      )
      .toBeLessThanOrEqual(150)

    const headerBox = await page.locator('header').boundingBox()
    const filialesBox = await homePage.filialesSection.boundingBox()
    expect(headerBox, 'le header doit être mesurable').toBeTruthy()
    expect(filialesBox, 'la section #filiales doit être mesurable').toBeTruthy()
    // scroll-mt-24 (96px) garantit que le haut de la section reste sous le header fixe.
    expect(filialesBox!.y).toBeGreaterThanOrEqual(headerBox!.height - 2)
  })

  test('should display exactly 4 chiffres items with a computed effectif (^\\d+\\+$) and filiales count, and the hero badge (>= lg)', async ({
    page,
    request,
  }) => {
    const [sections, filiales] = await Promise.all([
      request.get('/api/public/sites/holding/sections?page=ACCUEIL').then((r) => r.json()) as Promise<AccueilSections>,
      request.get('/api/public/sites').then((r) => r.json()) as Promise<PublicSiteSummaryDto[]>,
    ])
    expect(sections.chiffres, 'ACCUEIL:chiffres doit exister').toBeTruthy()
    const items = sections.chiffres!.items
    expect(items).toHaveLength(4)

    const effectifItem = items.find((item) => /^\d+\+$/.test(item.valeur))
    expect(effectifItem, "un item chiffré doit correspondre au motif effectif '^\\d+\\+$'").toBeTruthy()

    const filialesItem = items.find((item) => item.valeur === String(filiales.length))
    expect(filialesItem, 'un item chiffré doit valoir le nombre de filiales').toBeTruthy()

    const homePage = new HomePage(page)
    await homePage.goto()

    const dl = page.locator('dl').filter({ has: page.locator('dt') })
    await expect(dl.locator('dt')).toHaveCount(4)
    for (const item of items) {
      const entry = dl.locator('div', { has: page.getByText(item.libelle, { exact: true }) })
      await expect(entry.getByText(item.valeur, { exact: true })).toBeVisible()
    }

    const viewport = page.viewportSize()
    // Scopé à la section hero : le même texte paddé (ex. "06") apparaît aussi comme numéro de
    // ligne de filiale (`numero()`, HoldingFiliales.vue), toujours visible quel que soit le viewport.
    const badgeCard = homePage.heroSection.getByText(String(filiales.length).padStart(2, '0'), { exact: true })
    if (viewport && viewport.width >= LG_BREAKPOINT_PX) {
      await expect(badgeCard).toBeVisible()
    } else {
      await expect(badgeCard).toBeHidden()
    }
  })

  test('should point the final CTA to /contact', async ({ page, request }) => {
    const sections = (await request
      .get('/api/public/sites/holding/sections?page=ACCUEIL')
      .then((r) => r.json())) as AccueilSections
    expect(sections.cta, 'ACCUEIL:cta doit exister').toBeTruthy()

    const homePage = new HomePage(page)
    await homePage.goto()

    const ctaLink = homePage.finalCtaSection.getByRole('link', { name: sections.cta!.ctaLibelle, exact: true })
    await expect(ctaLink).toHaveAttribute('href', '/contact')
  })

  test('should reflect an admin edit of ACCUEIL:hero.titre and ACCUEIL:filiales.titre immediately (ISR invalidation)', async ({
    page,
    browser,
  }) => {
    const adminContext = await browser.newContext()
    let heroEntry: AdminSectionRow | undefined
    let filialesEntry: AdminSectionRow | undefined

    try {
      await loginAs(adminContext, SUPER_ADMIN)
      const rows = (await adminContext.request
        .get('/api/admin/contenu/sections?site=holding')
        .then((r) => r.json())) as AdminSectionRow[]
      heroEntry = rows.find((row) => row.page === 'ACCUEIL' && row.cle === 'hero')
      filialesEntry = rows.find((row) => row.page === 'ACCUEIL' && row.cle === 'filiales')
      expect(heroEntry, 'ACCUEIL:hero doit exister côté admin').toBeTruthy()
      expect(filialesEntry, 'ACCUEIL:filiales doit exister côté admin').toBeTruthy()

      const marker = `E2E${Date.now()}`
      const newHeroTitre = `Titre hero modifié ${marker}`
      const newFilialesTitre = `Titre filiales modifié ${marker}`

      const heroPatch = await adminContext.request.patch(`/api/admin/contenu/sections/${heroEntry!.uuid}`, {
        data: { donnees: { ...heroEntry!.donnees, titre: newHeroTitre } },
      })
      expect(heroPatch.ok(), await heroPatch.text()).toBeTruthy()

      const filialesPatch = await adminContext.request.patch(`/api/admin/contenu/sections/${filialesEntry!.uuid}`, {
        data: { donnees: { ...filialesEntry!.donnees, titre: newFilialesTitre } },
      })
      expect(filialesPatch.ok(), await filialesPatch.text()).toBeTruthy()

      const homePage = new HomePage(page)
      // Navigation fraîche (pas de SPA) : preuve que la purge ISR a bien eu lieu.
      await homePage.goto()
      await expect(homePage.h1).toContainText(newHeroTitre)
      await expect(homePage.filialesHeading).toContainText(newFilialesTitre)
    } finally {
      if (heroEntry) {
        await adminContext.request.patch(`/api/admin/contenu/sections/${heroEntry.uuid}`, {
          data: { donnees: heroEntry.donnees },
        })
      }
      if (filialesEntry) {
        await adminContext.request.patch(`/api/admin/contenu/sections/${filialesEntry.uuid}`, {
          data: { donnees: filialesEntry.donnees },
        })
      }
      if (heroEntry || filialesEntry) {
        const homePage = new HomePage(page)
        await homePage.goto()
        if (heroEntry) await expect(homePage.h1).toHaveText(parseAccentTitre((heroEntry.donnees as HeroDonnees).titre).plain)
        if (filialesEntry) {
          await expect(homePage.filialesHeading).toContainText((filialesEntry.donnees as SectionDonnees).titre.replace(/\n/g, ''))
        }
      }
      await adminContext.close()
    }
  })

  test('should fit within 375px width, hide the decorative blob and keep the H1 fully visible (mobile only)', async ({ page }) => {
    const viewport = page.viewportSize()
    test.skip(!viewport || viewport.width !== 375, "Ce critère ne s'applique qu'au viewport mobile (375px)")

    const externalRequests = trackExternalRequests(page)
    const homePage = new HomePage(page)
    const response = await homePage.goto()
    expect(response?.status()).toBe(200)

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(scrollWidth).toBeLessThanOrEqual(375)

    const blob = page.locator('svg[aria-hidden="true"] path.fill-navy')
    await expect(blob).toBeHidden()
    await expect(homePage.h1).toBeInViewport()

    expect(externalRequests, `Requêtes vers un hôte externe détectées : ${externalRequests.join(', ')}`).toHaveLength(0)
  })

  test('should contain no computed CSS gradient background and no v-html marker in the T2 component files', async ({ page }) => {
    const homePage = new HomePage(page)
    const response = await homePage.goto()
    expect(response?.status()).toBe(200)

    const gradientElementCount = await page.evaluate(() => {
      let count = 0
      document.querySelectorAll('*').forEach((el) => {
        if (getComputedStyle(el).backgroundImage.includes('gradient')) count += 1
      })
      return count
    })
    expect(gradientElementCount).toBe(0)

    const filesToCheck = [
      'app/pages/index.vue',
      'app/components/site/accueil/HoldingHero.vue',
      'app/components/site/accueil/HoldingFiliales.vue',
      'app/components/site/accueil/HoldingChiffres.vue',
      'app/components/site/SectionCta.vue',
    ]
    for (const relativePath of filesToCheck) {
      const content = readFileSync(join(process.cwd(), relativePath), 'utf-8')
      expect(content, `v-html trouvé dans ${relativePath}`).not.toMatch(/v-html/)
    }
  })

  test('should keep all content visible with prefers-reduced-motion: reduce (no residual opacity 0)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const homePage = new HomePage(page)
    const response = await homePage.goto()
    expect(response?.status()).toBe(200)

    await expect(homePage.h1).toBeVisible()
    // Les lignes de filiales et les items de chiffres sont animés en entrée via `v-motion`
    // (opacity 0 -> 1 au scroll) : sous reduced-motion, `useReveal` ne pose plus d'état initial
    // caché, donc tout doit rester visible sans le moindre scroll.
    await expect(homePage.filialesRows.first()).toBeVisible()
    await expect(homePage.filialesRows.last()).toBeVisible()
    await expect(page.locator('dl dd').first()).toBeVisible()
    await expect(page.locator('dl dd').last()).toBeVisible()

    const residualZeroOpacity = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('section, li, h1, h2, p, a, dd, dt'))
      return candidates.filter((el) => getComputedStyle(el).opacity === '0').length
    })
    expect(residualZeroOpacity).toBe(0)
  })

  test('should load the hero image eagerly with high fetchpriority, and filiale images lazily', async ({ page, request }) => {
    const [site, sections, filiales] = await Promise.all([
      request.get('/api/public/sites/holding').then((r) => r.json()) as Promise<PublicSiteDto>,
      request.get('/api/public/sites/holding/sections?page=ACCUEIL').then((r) => r.json()) as Promise<AccueilSections>,
      request.get('/api/public/sites').then((r) => r.json()) as Promise<PublicSiteSummaryDto[]>,
    ])
    const heroImageKey = sections.hero?.imageKey ?? site.heroImageKey

    const homePage = new HomePage(page)
    await homePage.goto()

    const heroImg = page.locator('section').first().locator('img').first()
    if (heroImageKey) {
      await expect(heroImg).toHaveAttribute('loading', 'eager')
      await expect(heroImg).toHaveAttribute('fetchpriority', 'high')
      await expect(heroImg).toHaveAttribute('src', `/api/files/${heroImageKey}`)
    } else {
      await expect(heroImg).toHaveCount(0)
    }

    const filialeWithImage = filiales.find((f) => f.heroImageKey)
    if (filialeWithImage) {
      const index = filiales.indexOf(filialeWithImage)
      const filialeImg = homePage.filialesRows.nth(index).locator('img')
      await expect(filialeImg).toHaveAttribute('loading', 'lazy')
      const fetchpriority = await filialeImg.getAttribute('fetchpriority')
      expect(fetchpriority).toBeNull()
    }
  })
})
