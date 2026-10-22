// /admin/contenu/site — fiche de la société (spec phase 3 §5 T3, §6 critère 11). Couvre :
//  - édition du secteur par un SUPER_ADMIN, répercutée immédiatement sur `/` (ISR) ;
//  - visibilité des champs structurels (nom, ordre) réservés au SUPER_ADMIN ;
//  - scoping ADMIN_FILIALE (sa seule filiale, sans nom/ordre) ;
//  - vidage d'un champ nullable (email) -> `null` sans 400 ;
//  - erreur de validation (secteur < 2 caractères) affichée sous le champ.
// Chaque test restaure ce qu'il modifie (try/finally), y compris en cas d'échec, et utilise son
// propre contexte de navigateur authentifié (indépendance entre tests).
import { test, expect, type BrowserContext, type Locator, type Page } from '@playwright/test'
import { loginAs, SUPER_ADMIN, ADMIN_FILIALE_ENTRETIEN } from './helpers/auth'

const HTTP = { UNAUTHORIZED: 401 } as const

// vue-router (stringifyQuery par défaut) ne code pas les `/` dans la query : le test tolère
// les deux formes, comme `admin-shell.spec.ts`.
const LOGIN_URL_401 = /\/admin\/login\?redirect=(%2F|\/)admin(%2F|\/)contenu(%2F|\/)site/

interface AdminSiteSummaryDto {
  readonly uuid: string
  readonly slug: string
  readonly nom: string
  readonly nomCourt: string | null
}

interface AdminSiteReglagesDto extends AdminSiteSummaryDto {
  readonly secteur: string | null
  readonly description: string | null
  readonly email: string | null
  readonly ordre: number
}

// --- Page Object ---------------------------------------------------------------------------
class SiteContentPage {
  constructor(private readonly page: Page) {}

  goto() {
    return this.page.goto('/admin/contenu/site')
  }

  get siteSelector(): Locator {
    return this.page.getByRole('combobox', { name: 'Site à gérer' })
  }

  async selectSite(label: string): Promise<void> {
    await this.siteSelector.click()
    await this.page.getByRole('option', { name: label, exact: true }).click()
  }

  get modifierButton(): Locator {
    return this.page.getByRole('button', { name: 'Modifier' })
  }

  get dialog(): Locator {
    return this.page.getByRole('dialog')
  }

  async openEdit(): Promise<void> {
    await this.modifierButton.click()
    await expect(this.dialog).toBeVisible()
  }

  get saveButton(): Locator {
    return this.dialog.getByRole('button', { name: 'Enregistrer' })
  }
}

async function fetchEntretien(context: BrowserContext): Promise<AdminSiteReglagesDto> {
  const list = (await context.request.get('/api/admin/sites').then((r) => r.json())) as AdminSiteSummaryDto[]
  const summary = list.find((s) => s.slug === 'entretien')
  expect(summary, 'la filiale entretien doit être seedée').toBeTruthy()
  return context.request.get(`/api/admin/sites/${summary!.uuid}`).then((r) => r.json())
}

test.describe('Parcours CMS admin — fiche de la société (/admin/contenu/site)', () => {
  test('should let a SUPER_ADMIN edit the sector via the UI and reflect it on the home page immediately', async ({ browser }) => {
    // Deux éditions complètes (modification + restauration) et un rendu public : dépasse
    // le délai par défaut sur une machine lente, sans que l'application soit en cause.
    test.slow()
    const adminContext = await browser.newContext()
    let originalSecteur: string | null = null
    let entretienNom = ''

    try {
      await loginAs(adminContext, SUPER_ADMIN)
      const before = await fetchEntretien(adminContext)
      originalSecteur = before.secteur
      entretienNom = before.nom
      expect(originalSecteur, "le secteur d'entretien doit avoir une valeur par défaut (seed)").toBeTruthy()

      const page = await adminContext.newPage()
      const siteContent = new SiteContentPage(page)
      await siteContent.goto()

      const summaryLabel = before.nomCourt ?? before.nom
      await siteContent.selectSite(summaryLabel)
      await siteContent.openEdit()

      const marker = `Secteur E2E ${Date.now()}`
      await siteContent.dialog.getByLabel('Secteur').fill(marker)
      await siteContent.saveButton.click()
      await expect(page.getByText('Fiche mise à jour.')).toBeVisible()
      await expect(page.getByText(marker)).toBeVisible()

      const publicPage = await adminContext.newPage()
      await publicPage.goto('/')
      const row = publicPage.locator('#filiales li', { hasText: entretienNom })
      await expect(row.getByText(marker, { exact: true })).toBeVisible()
      await publicPage.close()

      await page.close()
    } finally {
      if (originalSecteur !== null) {
        const restorePage = await adminContext.newPage()
        const restoreSiteContent = new SiteContentPage(restorePage)
        await restoreSiteContent.goto()
        const summary = await fetchEntretien(adminContext)
        await restoreSiteContent.selectSite(summary.nomCourt ?? summary.nom)
        await restoreSiteContent.openEdit()
        await restoreSiteContent.dialog.getByLabel('Secteur').fill(originalSecteur)
        await restoreSiteContent.saveButton.click()
        await expect(restorePage.getByText('Fiche mise à jour.')).toBeVisible()
        await expect
          .poll(async () => (await fetchEntretien(adminContext)).secteur, { message: 'le secteur original doit être restauré en base' })
          .toBe(originalSecteur)
        await restorePage.close()
      }
      await adminContext.close()
    }
  })

  test('should show the "nom" and "ordre" fields only to a SUPER_ADMIN', async ({ browser }) => {
    const adminContext = await browser.newContext()
    try {
      await loginAs(adminContext, SUPER_ADMIN)
      const before = await fetchEntretien(adminContext)

      const page = await adminContext.newPage()
      const siteContent = new SiteContentPage(page)
      await siteContent.goto()
      await siteContent.selectSite(before.nomCourt ?? before.nom)
      await siteContent.openEdit()

      await expect(siteContent.dialog.getByLabel('Nom légal')).toBeVisible()
      await expect(siteContent.dialog.getByLabel("Ordre d'affichage")).toBeVisible()
      await page.close()
    } finally {
      await adminContext.close()
    }
  })

  test('should scope an ADMIN_FILIALE to their own site only, without the "nom"/"ordre" fields or a site selector', async ({
    browser,
  }) => {
    const adminContext = await browser.newContext()
    try {
      await loginAs(adminContext, ADMIN_FILIALE_ENTRETIEN)
      const list = (await adminContext.request.get('/api/admin/sites').then((r) => r.json())) as AdminSiteSummaryDto[]
      expect(list, "un ADMIN_FILIALE ne doit voir que sa propre filiale dans la liste des sites").toHaveLength(1)
      const own = list[0]!

      const page = await adminContext.newPage()
      const siteContent = new SiteContentPage(page)
      await siteContent.goto()

      await expect(siteContent.siteSelector).toHaveCount(0)
      // Scopé au bloc de la fiche : le nom apparaît AUSSI dans l'en-tête (`contexteNom`
      // ADMIN_FILIALE = nom complet, même clé `admin-sites`) → strict violation à la racine.
      const blocFiche = page.getByText('Fiche de la société').locator('..')
      await expect(blocFiche).toContainText(own.nomCourt ?? own.nom)

      await siteContent.openEdit()
      await expect(siteContent.dialog.getByLabel('Nom légal')).toHaveCount(0)
      await expect(siteContent.dialog.getByLabel("Ordre d'affichage")).toHaveCount(0)
      await page.close()
    } finally {
      await adminContext.close()
    }
  })

  test('should save an empty email as null (200), not a 400', async ({ browser }) => {
    const adminContext = await browser.newContext()
    let originalEmail: string | null = null

    try {
      await loginAs(adminContext, ADMIN_FILIALE_ENTRETIEN)
      const before = await fetchEntretien(adminContext)
      originalEmail = before.email

      const page = await adminContext.newPage()
      const siteContent = new SiteContentPage(page)
      await siteContent.goto()
      await siteContent.openEdit()

      await siteContent.dialog.getByLabel('Courriel').fill('')
      await siteContent.saveButton.click()
      await expect(page.getByText('Fiche mise à jour.')).toBeVisible()
      await expect(page.getByText('Courriel').locator('..').getByText('—')).toBeVisible()

      await expect.poll(async () => (await fetchEntretien(adminContext)).email).toBeNull()
      await page.close()
    } finally {
      if (originalEmail !== null) {
        const restorePage = await adminContext.newPage()
        const restoreSiteContent = new SiteContentPage(restorePage)
        await restoreSiteContent.goto()
        await restoreSiteContent.openEdit()
        await restoreSiteContent.dialog.getByLabel('Courriel').fill(originalEmail)
        await restoreSiteContent.saveButton.click()
        await expect(restorePage.getByText('Fiche mise à jour.')).toBeVisible()
        await expect.poll(async () => (await fetchEntretien(adminContext)).email).toBe(originalEmail)
        await restorePage.close()
      }
      await adminContext.close()
    }
  })

  test('should show a validation error under the field when the sector is a single character, and not persist it', async ({
    browser,
  }) => {
    const adminContext = await browser.newContext()
    try {
      await loginAs(adminContext, ADMIN_FILIALE_ENTRETIEN)
      const before = await fetchEntretien(adminContext)

      const page = await adminContext.newPage()
      const siteContent = new SiteContentPage(page)
      await siteContent.goto()
      await siteContent.openEdit()

      await siteContent.dialog.getByLabel('Secteur').fill('A')
      await siteContent.saveButton.click()

      // L'erreur va sous le champ (`role="alert"`, CmsFieldInput.vue), jamais en toast.
      await expect(siteContent.dialog.getByRole('alert')).toBeVisible()
      await expect(siteContent.dialog).toBeVisible() // le dialog reste ouvert, rien n'a été soumis
      await expect(page.getByText('Fiche mise à jour.')).toHaveCount(0)

      const after = await fetchEntretien(adminContext)
      expect(after.secteur).toBe(before.secteur)
      await page.close()
    } finally {
      await adminContext.close()
    }
  })

  test('should redirect to the login page when the session expires on the sites list (401)', async ({ browser }) => {
    const adminContext = await browser.newContext()
    try {
      await loginAs(adminContext, SUPER_ADMIN)
      const page = await adminContext.newPage()
      await page.route('**/api/admin/sites', (route) =>
        route.fulfill({
          status: HTTP.UNAUTHORIZED,
          contentType: 'application/json',
          body: JSON.stringify({ statusMessage: 'Session invalide' }),
        }),
      )

      await page.goto('/admin/contenu/site')

      // watchAdminUnauthorized vide la session ET le cache admin, puis navigue avec la cible.
      await expect(page).toHaveURL(LOGIN_URL_401)
    } finally {
      await adminContext.close()
    }
  })

  test('should redirect to the login page when the site detail load fails with 401', async ({ browser }) => {
    const adminContext = await browser.newContext()
    try {
      await loginAs(adminContext, SUPER_ADMIN)
      const page = await adminContext.newPage()
      // Liste OK (le sélecteur se remplit), détail GET /api/admin/sites/<uuid> en 401.
      await page.route('**/api/admin/sites/*', (route) =>
        route.fulfill({
          status: HTTP.UNAUTHORIZED,
          contentType: 'application/json',
          body: JSON.stringify({ statusMessage: 'Session invalide' }),
        }),
      )

      await page.goto('/admin/contenu/site')

      await expect(page).toHaveURL(LOGIN_URL_401)
    } finally {
      await adminContext.close()
    }
  })
})
