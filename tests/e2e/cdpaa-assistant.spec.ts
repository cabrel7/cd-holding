// Assistant import-export (cdpaa /services) — spec docs/specs/lot3-pages-specifiques.md §4,
// §6 critère 9 et 11. Questionnaire SCRIPTÉ (DEC-14) : aucune IA. Exécuté contre le BUILD DE
// PRODUCTION. Le texte de la recommandation attendu est lu dans l'API des sections
// (SERVICES:assistant.recommandations[palier]) : aucune chaîne marketing recopiée ici. Les
// questions/options/libellés d'étapes viennent de shared/content/cdpaa/assistant-import-export.ts
// (structure du questionnaire = code, pas contenu éditable).
//
// Isolation rate-limit : le bucket `contact` (5 / 10 min / IP) est partagé avec les formulaires de
// contact ; x-forwarded-for 203.0.113.x distinct par test. E-mails de test uniques, supprimés en
// afterAll (--contact-email).
import { test, expect, type Locator, type Page } from '@playwright/test'
import {
  ASSISTANT_FORM,
  ETAPES_ASSISTANT,
  ETAPE_CONTACT,
  NOMBRE_ETAPES,
  palierRecommandation,
  recapReponses,
  type ReponsesAssistant,
} from '#shared/content/cdpaa/assistant-import-export'
import { loginAs, SUPER_ADMIN } from './helpers/auth'
import type { AdminMessageDto, AdminPage } from '#shared/types/admin'
import { nextTestIp } from './helpers/ip'
import { nettoyer } from './helpers/db'

const VIEWPORT_MOBILE = { width: 375, height: 812 } as const
const MIN_TARGET_PX = 44
const INDEX_OPTION_CHOISIE = 1 // 2e option de chaque question : volume '200-1000kg' -> palier « moyen »
const MAX_TAB = 6
const HTTP_TOO_MANY = 429
const HTTP_SERVER_ERROR = 500

interface AssistantSectionDto {
  readonly recommandations: { readonly petit: string; readonly moyen: string; readonly grand: string }
  readonly mentionDelai: string
}

const suffixe = Date.now()
const contactEmails: string[] = []
function emailTest(label: string): string {
  const email = `e2e-lot3-assistant-${label}-${suffixe}-${Math.random().toString(36).slice(2, 7)}@example.test`
  contactEmails.push(email)
  return email
}

/** Réponses attendues quand on choisit la 2e option à chaque étape. */
function reponsesChoisies(): ReponsesAssistant {
  const r: Record<string, string> = {}
  for (const etape of ETAPES_ASSISTANT) r[etape.cle] = etape.options[INDEX_OPTION_CHOISIE]!.value
  return r as unknown as ReponsesAssistant
}

class ServicesAssistantPage {
  constructor(private readonly page: Page) {}
  goto() {
    return this.page.goto('/cdpaa/services')
  }
  get continuer(): Locator { return this.page.getByRole('button', { name: 'Continuer' }) }
  get retour(): Locator { return this.page.getByRole('button', { name: 'Retour' }) }
  get nom(): Locator { return this.page.getByLabel('Nom', { exact: true }) }
  get entreprise(): Locator { return this.page.getByLabel('Entreprise (facultatif)', { exact: true }) }
  get courriel(): Locator { return this.page.getByLabel('Courriel', { exact: true }) }
  get telephone(): Locator { return this.page.getByLabel('Téléphone (facultatif)', { exact: true }) }
  get envoyer(): Locator { return this.page.getByRole('button', { name: ASSISTANT_FORM.bouton }) }
  get recommencer(): Locator { return this.page.getByRole('button', { name: 'Recommencer' }) }
  question(texte: string): Locator { return this.page.getByText(texte, { exact: true }) }
  radio(label: string): Locator { return this.page.getByRole('radio', { name: label, exact: true }) }

  /** Sélection et passage à l'étape suivante au clavier seul : la question reçoit le focus à
   * chaque étape, Tab atteint le groupe de radios, Espace choisit, Tab*n atteint « Continuer ». */
  async etapeAuClavier(index: number): Promise<void> {
    const etape = ETAPES_ASSISTANT[index]!
    const legende = this.page.getByText(etape.question, { exact: true })
    // Étape 1 : la page ne vole pas le focus au chargement ; le clavier part de la question.
    if (index === 0) await legende.focus()
    await expect(legende).toBeFocused()
    await this.page.keyboard.press('Tab')
    await expect(this.page.getByRole('radio').first()).toBeFocused()
    for (let i = 0; i < INDEX_OPTION_CHOISIE; i += 1) await this.page.keyboard.press('ArrowDown')
    await expect(this.radio(etape.options[INDEX_OPTION_CHOISIE]!.label)).toBeChecked()
    await this.appuyerTabJusqua(this.continuer)
    await this.page.keyboard.press('Enter')
  }

  async appuyerTabJusqua(cible: Locator): Promise<void> {
    for (let i = 0; i < MAX_TAB; i += 1) {
      await this.page.keyboard.press('Tab')
      if (await cible.evaluate((el) => el === document.activeElement)) return
    }
    throw new Error('Le bouton cible n’est pas atteignable au clavier')
  }

  async remplirContact(email: string): Promise<void> {
    await this.nom.fill('Jean Tremblay')
    await this.entreprise.fill('Épicerie e2e')
    await this.courriel.fill(email)
    await this.telephone.fill('514-555-0123')
  }

  async allerAuContact(): Promise<void> {
    await this.goto()
    for (let i = 0; i < ETAPES_ASSISTANT.length; i += 1) {
      await this.etapeAuClavier(i)
    }
    await expect(this.page.getByText(ETAPE_CONTACT.question, { exact: true })).toBeFocused()
  }
}

function suivreContact(page: Page): string[] {
  const corps: string[] = []
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('/api/public/contact')) corps.push(req.postData() ?? '')
  })
  return corps
}

test.describe('cdpaa — assistant import-export (services)', () => {
  test.afterAll(() => {
    test.setTimeout(240_000)
    nettoyer({ contactEmails })
  })

  test.beforeEach(async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': nextTestIp() })
  })

  test('should render the assistant on cdpaa/services (200) with « Continuer » disabled, no « Retour » and a 5-step counter on step 1', async ({ page, request }) => {
    expect((await request.get('/cdpaa/services')).status()).toBe(200)
    const a = new ServicesAssistantPage(page)
    await a.goto()
    await expect(a.question(ETAPES_ASSISTANT[0].question)).toBeVisible()
    await expect(a.continuer).toBeDisabled()
    await expect(a.retour).toHaveCount(0)
    await expect(page.getByText(`Étape 1 sur ${NOMBRE_ETAPES}`).first()).toBeVisible()
    for (const option of ETAPES_ASSISTANT[0].options) await expect(a.radio(option.label)).toBeAttached()
  })

  test('should not show the assistant on the other subsidiaries services pages (no cdpaa hard-coding)', async ({ page }) => {
    await page.goto('/entretien/services')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continuer' })).toHaveCount(0)
  })

  test('should enable « Continuer » after a choice, go back with « Retour » keeping the previous answer, and disable it again on the next unanswered step', async ({ page }) => {
    const a = new ServicesAssistantPage(page)
    await a.goto()
    const [e1, e2] = ETAPES_ASSISTANT
    await a.radio(e1.options[0].label).check({ force: true })
    await expect(a.continuer).toBeEnabled()
    await a.continuer.click()
    await expect(a.question(e2.question)).toBeVisible()
    await expect(a.continuer).toBeDisabled()
    await expect(a.retour).toBeVisible()
    await a.retour.click()
    await expect(a.question(e1.question)).toBeVisible()
    await expect(a.radio(e1.options[0].label)).toBeChecked()
  })

  test('should complete the 5 steps with the keyboard only, validate the contact step, then show the recommendation and a labelled recap (no raw keys, no « IA »)', async ({ page, request }) => {
    test.slow()
    const sections = (await (await request.get('/api/public/sites/cdpaa/sections?page=SERVICES')).json()) as { assistant?: AssistantSectionDto }
    expect(sections.assistant, 'SERVICES:assistant doit exister pour cdpaa (base de dev : seed en amorçage)').toBeTruthy()

    const reponses = reponsesChoisies()
    const palier = palierRecommandation(reponses.volume)
    const email = emailTest('parcours')
    const a = new ServicesAssistantPage(page)
    const envois = suivreContact(page)

    await a.allerAuContact()
    await expect(page.getByText(`Étape ${NOMBRE_ETAPES} sur ${NOMBRE_ETAPES}`).first()).toBeVisible()

    // Étape 5, envoi vide : erreurs, focus sur le premier champ invalide, zéro requête.
    await a.envoyer.click()
    await expect(a.nom).toBeFocused()
    await expect(a.nom).toHaveAttribute('aria-invalid', 'true')
    await expect(a.courriel).toHaveAttribute('aria-invalid', 'true')
    expect(envois).toHaveLength(0)

    await a.remplirContact(email)
    await a.telephone.press('Enter')
    await expect(page.getByText(ASSISTANT_FORM.toastTitre)).toBeVisible()

    await expect(page.getByRole('heading', { name: 'Notre recommandation' })).toBeFocused()
    await expect(page.getByText(sections.assistant!.recommandations[palier], { exact: true })).toBeVisible()
    await expect(page.getByText(sections.assistant!.mentionDelai.replace(/\*/g, '').replace(/\n/g, ''))).toBeVisible()
    for (const ligne of recapReponses(reponses)) {
      // Portée = la liste de définitions du récapitulatif (« Restaurant » existe aussi dans la nav).
      await expect(page.locator('dl').getByText(ligne.libelle, { exact: true })).toBeVisible()
      await expect(page.locator('dl').getByText(ligne.valeur, { exact: true })).toBeVisible()
    }
    for (const brute of Object.values(reponses)) await expect(page.getByText(brute, { exact: true })).toHaveCount(0)
    const texte = await page.locator('body').innerText()
    expect(texte).not.toMatch(/\b(IA|AI)\b|intelligence artificielle/i)

    expect(envois, 'un seul envoi').toHaveLength(1)
    const corps = JSON.parse(envois[0]!) as Record<string, unknown>
    expect(corps.formulaire).toBe('assistant')
    expect(corps.reponses).toEqual(reponses)
    expect(corps).not.toHaveProperty('palier') // calculé côté serveur

    // Persistance (§6 critère 9) : message ASSISTANT_IMPORT_EXPORT avec clés stables + palier.
    const adminContext = await page.context().browser()!.newContext({ baseURL: test.info().project.use.baseURL })
    try {
      await loginAs(adminContext, SUPER_ADMIN)
      const page = (await (await adminContext.request.get(`/api/admin/messages?q=${encodeURIComponent(email)}`)).json()) as AdminPage<AdminMessageDto>
      const cree = page.items.find((m) => m.email === email)
      expect(cree, 'le message doit être visible via GET /api/admin/messages').toBeTruthy()
      expect(cree!.type).toBe('ASSISTANT_IMPORT_EXPORT')
      expect(cree!.site.slug).toBe('cdpaa')
      expect(cree!.formulaire).toBe('assistant')
      expect(cree, 'details ne doit jamais être renvoyé brut').not.toHaveProperty('details')
      // Le palier est recalculé côté serveur et traduit en libellé (jamais la clé brute).
      expect(cree!.champs.map((c) => c.libelle)).toContain('Palier recommandé')
      for (const ligne of recapReponses(reponses)) expect(cree!.champs).toContainEqual({ libelle: ligne.libelle, valeur: ligne.valeur })
      for (const ligne of recapReponses(reponses)) expect(cree!.message).toContain(`${ligne.libelle} : ${ligne.valeur}`)
    } finally {
      await adminContext.close()
    }

    await a.recommencer.click()
    await expect(a.question(ETAPES_ASSISTANT[0].question)).toBeVisible()
    await expect(a.continuer).toBeDisabled()
  })

  for (const [statut, toastAttendu] of [
    [HTTP_TOO_MANY, /Trop d’envois/],
    [HTTP_SERVER_ERROR, /L’envoi a échoué/],
  ] as const) {
    test(`should keep step 5 and the entered values with an error toast when the server answers ${statut}`, async ({ page }) => {
      const a = new ServicesAssistantPage(page)
      await page.route('**/api/public/contact', (route) =>
        route.fulfill({ status: statut, headers: statut === HTTP_TOO_MANY ? { 'retry-after': '120' } : {}, json: { statusMessage: 'x' } }),
      )
      await a.allerAuContact()
      const email = emailTest(`echec-${statut}`)
      await a.remplirContact(email)
      await a.envoyer.click()
      await expect(page.getByText(toastAttendu)).toBeVisible()
      await expect(a.nom).toHaveValue('Jean Tremblay')
      await expect(a.courriel).toHaveValue(email)
      await expect(page.getByRole('heading', { name: 'Notre recommandation' })).toHaveCount(0)
      await expect(a.envoyer).toBeEnabled()
    })
  }

  test.describe('375 px', () => {
    test.use({ viewport: VIEWPORT_MOBILE })

    test('should not scroll horizontally on any step and keep interactive targets >= 44 px', async ({ page }) => {
      const a = new ServicesAssistantPage(page)
      await a.goto()
      await expect(a.continuer).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(VIEWPORT_MOBILE.width)
      for (const option of ETAPES_ASSISTANT[0].options) {
        const box = await page.getByRole('group').getByText(option.label, { exact: true }).boundingBox()
        expect(box!.height, option.label).toBeGreaterThanOrEqual(MIN_TARGET_PX)
      }
      expect((await a.continuer.boundingBox())!.height).toBeGreaterThanOrEqual(MIN_TARGET_PX)

      await a.allerAuContact()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(VIEWPORT_MOBILE.width)
      for (const champ of [a.nom, a.entreprise, a.courriel, a.telephone]) {
        expect((await champ.boundingBox())!.height).toBeGreaterThanOrEqual(MIN_TARGET_PX)
      }
      expect((await a.envoyer.boundingBox())!.height).toBeGreaterThanOrEqual(MIN_TARGET_PX)
    })
  })
})
