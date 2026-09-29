// /contact — holding (spec docs/specs/phase3-holding-contact.md §6, critères 1 à 11). Contenu
// 100% depuis la base (CONTACT:contact/seo, COMMUN:mentionFormulaires, GET /api/public/sites) :
// aucune assertion sur un texte marketing/CMS écrit en dur ici — les valeurs attendues sont
// toujours lues depuis l'API publique (ou admin) avant d'être comparées au DOM (spec §6).
// Exception assumée, comme dans admin-site.spec.ts : les libellés d'INTERFACE (boutons, titres
// de toast, messages de validation zod) sont du code, pas du contenu éditable — ils sont donc
// cités tels quels depuis `HoldingContactForm.vue` / `shared/validation/contact.ts`.
//
// Isolation du rate-limit (`server/utils/rate-limit.ts`, scope 'contact', 5 req/10 min/IP,
// fenêtre glissante EN MÉMOIRE serveur) : chaque test qui appelle réellement POST
// /api/public/contact reçoit sa PROPRE IP TEST-NET tirée au hasard (203.0.113.x, RFC 5737),
// honorée car Playwright joint le serveur depuis le loopback (proxy de confiance,
// rate-limit.ts:30) : `page.setExtraHTTPHeaders` pour l'UI, en-tête `x-forwarded-for` explicite
// pour les requêtes API directes. Le pool (254 adresses) ne peut pas garantir zéro collision
// entre deux exécutions successives de cette suite dans la même fenêtre de 10 min (desktop, puis
// mobile, puis suite complète) : `postContactResilient`/`reserveFreshIp`/C6h retirent une
// nouvelle IP et réessaient la même requête (idempotente) si le 429 vient d'un bucket résiduel.
//
// Nettoyage : chaque MessageContact créé par un test utilise un e-mail de test dédié
// (@example.test, RFC 2606) collecté dans `contactTestEmails`, supprimé en `afterAll` via
// `pnpm exec tsx scripts/cleanup-test-data.ts --contact-email <e-mails>`. La section
// CONTACT:contact modifiée par le critère 11 est restaurée dans un `afterAll` dédié.
import { execFileSync } from 'node:child_process'
import { test, expect, type Locator, type Page } from '@playwright/test'
import { loginAs, SUPER_ADMIN } from './helpers/auth'
import type { AdminMessageDto, AdminPage } from '#shared/types/admin'

// --- Types DTO (contrats API, spec §2.3/§3.2/§4.1) -----------------------------------------
interface PublicSiteSummaryDto {
  readonly uuid: string
  readonly slug: string
  readonly nom: string
}

interface PublicSiteDto {
  readonly nom: string
  readonly email: string | null
  readonly groupe: { readonly nom: string; readonly mentionFormulaires: string | null }
}

interface FormulaireSectionDto {
  readonly surtitre?: string
  readonly titre: string
  readonly texte?: string
  readonly messageSucces: string
}

interface SeoSectionDto {
  readonly title: string
  readonly description: string
}

interface ContactSectionsDto {
  readonly seo?: SeoSectionDto
  readonly contact?: FormulaireSectionDto
}

interface AdminSectionRow {
  readonly uuid: string
  readonly page: string
  readonly cle: string
  readonly donnees: Record<string, unknown>
}


// --- Interpolation locale (miroir minimal de shared/utils/texte.ts:15-19 — seule la variable
// {groupe} est utilisée par ce contenu ; dupliqué plutôt qu'importé, comme parseAccentTitre
// dans home.spec.ts, pour ne pas coupler ce test au module partagé). ------------------------
function interpolerGroupe(texte: string, groupe: string): string {
  return texte.replace(/\{groupe\}/g, groupe)
}

// --- Isolation rate-limit : une IP TEST-NET (203.0.113.0/24, RFC 5737) tirée au hasard par test
// Le rate-limit (server/utils/rate-limit.ts, fenêtre glissante 10 min, EN MÉMOIRE serveur) survit
// à plusieurs exécutions successives de cette suite (desktop, puis mobile, puis suite complète)
// tant que le process serveur n'est pas redémarré : une IP déjà tirée par un run précédent PEUT
// donc arriver déjà partiellement consommée. Un pool fini (254 adresses) ne peut pas garantir
// zéro collision face à des runs répétés dans la même fenêtre de 10 min — `postContactResilient`
// et `reserveFreshIp` ci-dessous retirent une nouvelle IP et réessaient sur un 429 inattendu
// (requête idempotente, aucune écriture avant validation) plutôt que de risquer un faux échec.
const usedIpSuffixes = new Set<number>()
function nextTestIp(): string {
  let suffix: number
  do {
    suffix = 1 + Math.floor(Math.random() * 253) // 203.0.113.1 .. .253
  } while (usedIpSuffixes.has(suffix))
  usedIpSuffixes.add(suffix)
  return `203.0.113.${suffix}`
}

const MAX_IP_RETRIES = 8

/**
 * POST direct vers /api/public/contact, réessayé sur une IP fraîche si la réponse est 429 —
 * jamais parce que CE test dépasserait son propre quota (il n'envoie qu'une requête), mais
 * parce que l'IP tirée porte l'état résiduel d'un run précédent de cette même suite.
 */
async function postContactResilient(
  request: import('@playwright/test').APIRequestContext,
  build: (ip: string) => NonNullable<Parameters<import('@playwright/test').APIRequestContext['post']>[1]>,
) {
  let res: Awaited<ReturnType<import('@playwright/test').APIRequestContext['post']>> | undefined
  for (let attempt = 0; attempt < MAX_IP_RETRIES; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    res = await request.post('/api/public/contact', build(nextTestIp()))
    if (res.status() !== 429) return res
  }
  return res!
}

/** Réserve une IP dont le quota n'est pas déjà épuisé (sondée via un honeypot rempli : 201
 * garanti, aucune écriture) — pour les soumissions UI (une seule vraie requête attendue). */
async function reserveFreshIp(request: import('@playwright/test').APIRequestContext): Promise<string> {
  for (let attempt = 0; attempt < MAX_IP_RETRIES; attempt += 1) {
    const ip = nextTestIp()
    const probeEmail = `e2e-contact-probe-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`
    // eslint-disable-next-line no-await-in-loop
    const probe = await request.post('/api/public/contact', {
      headers: { 'x-forwarded-for': ip },
      data: validHoldingBody(probeEmail, { website: 'probe' }),
    })
    if (probe.status() !== 429) return ip
  }
  throw new Error('Impossible de réserver une IP de test (203.0.113.x) non limitée après plusieurs tentatives.')
}

// --- E-mails de test dédiés, nettoyés en afterAll -------------------------------------------
const contactTestEmails: string[] = []
function makeTestEmail(label: string, projectName: string): string {
  const email = `e2e-contact-${label}-${projectName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`
  contactTestEmails.push(email)
  return email
}

function validHoldingBody(email: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    formulaire: 'holding',
    nom: 'Jean Tremblay',
    email,
    cible: 'entretien',
    message: 'Bonjour, ceci est un message de test suffisamment long pour la validation du formulaire.',
    website: '',
    ...overrides,
  }
}

/** Requêtes du navigateur vers POST /api/public/contact — pour prouver l'absence d'appel. */
function trackContactRequests(page: Page): string[] {
  const urls: string[] = []
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('/api/public/contact')) urls.push(req.url())
  })
  return urls
}

// --- État module pour les afterAll (restauration section, nettoyage messages) --------------
let contactSectionEntry: AdminSectionRow | undefined

// --- Page Object ---------------------------------------------------------------------------
class ContactPage {
  constructor(private readonly page: Page) {}

  goto() {
    return this.page.goto('/contact')
  }

  get h1(): Locator {
    return this.page.getByRole('heading', { level: 1 })
  }

  get form(): Locator {
    return this.page.locator('form')
  }

  get nomInput(): Locator {
    return this.page.getByLabel('Nom complet')
  }

  get emailInput(): Locator {
    return this.page.getByLabel('Courriel')
  }

  /**
   * BUG applicatif — app/components/site/contact/HoldingContactForm.vue:161-163 : `FormControl`
   * enveloppe un `<div class="relative">` (icône ChevronDown) au lieu du `<select>` lui-même.
   * Le `Slot` de FormControl pose donc `id`/`aria-invalid`/`aria-describedby` sur ce `<div>`,
   * et le `<label for="…">` (FormLabel) cible ce même id — jamais le `<select>` réel, qui ne
   * reçoit ni id, ni aria-invalid, ni aria-describedby. `getByLabel('Filiale concernée')` ne
   * peut donc PAS résoudre le contrôle : label et select sont associés uniquement par la
   * proximité visuelle, pas par le DOM/l'accessibilité. Localisé ici par structure (seul
   * `<select>` du formulaire) en attendant le correctif (voir test dédié plus bas).
   */
  get cibleSelect(): Locator {
    return this.form.locator('select')
  }

  get messageInput(): Locator {
    return this.page.getByLabel('Votre message')
  }

  get submitButton(): Locator {
    return this.page.getByRole('button', { name: /Envoyer le message|Envoi en cours/ })
  }

  get alerts(): Locator {
    return this.form.getByRole('alert')
  }

  async fillValid(values: { nom: string; email: string; cible: string; message: string }): Promise<void> {
    await this.nomInput.fill(values.nom)
    await this.emailInput.fill(values.email)
    await this.cibleSelect.selectOption(values.cible)
    await this.messageInput.fill(values.message)
  }
}

test.describe('/contact — holding, formulaire de contact public', () => {
  // --- Critère 1 -----------------------------------------------------------------------------
  test('should render a single H1 from CONTACT:contact.titre, surtitre/texte from the API and an interpolated document title', async ({
    page,
    request,
  }) => {
    const [sections, site] = await Promise.all([
      request.get('/api/public/sites/holding/sections?page=CONTACT').then((r) => r.json()) as Promise<ContactSectionsDto>,
      request.get('/api/public/sites/holding').then((r) => r.json()) as Promise<PublicSiteDto>,
    ])
    expect(sections.contact, 'CONTACT:contact doit exister').toBeTruthy()
    const contact = sections.contact!

    const contactPage = new ContactPage(page)
    const response = await contactPage.goto()
    expect(response?.status()).toBe(200)

    await expect(contactPage.h1).toHaveCount(1)
    await expect(contactPage.h1).toHaveText(interpolerGroupe(contact.titre, site.groupe.nom))

    // Scopé au parent du H1 (ContactIntro) : le libellé de nav "Nous joindre" (header, lien
    // actif vers /contact) peut coïncider avec le surtitre CMS et rendre `page.getByText` ambigu.
    const introContainer = contactPage.h1.locator('..')
    if (contact.surtitre) {
      await expect(introContainer.getByText(contact.surtitre, { exact: true })).toBeVisible()
    }
    if (contact.texte) {
      await expect(introContainer.getByText(interpolerGroupe(contact.texte, site.groupe.nom), { exact: true })).toBeVisible()
    }

    if (sections.seo) {
      await expect(page).toHaveTitle(interpolerGroupe(sections.seo.title, site.groupe.nom))
    }
  })

  // --- Critère 2 -----------------------------------------------------------------------------
  test('should list select options as placeholder + holding (general) + filiales in GET /api/public/sites order', async ({
    page,
    request,
  }) => {
    const [filiales, site] = await Promise.all([
      request.get('/api/public/sites').then((r) => r.json()) as Promise<PublicSiteSummaryDto[]>,
      request.get('/api/public/sites/holding').then((r) => r.json()) as Promise<PublicSiteDto>,
    ])
    expect(filiales.length, 'au moins une filiale doit être seedée').toBeGreaterThan(0)

    const contactPage = new ContactPage(page)
    await contactPage.goto()

    const options = contactPage.cibleSelect.locator('option')
    await expect(options).toHaveCount(filiales.length + 2)

    await expect(options.nth(0)).toHaveText('Sélectionnez une filiale')
    await expect(options.nth(0)).toBeDisabled()
    await expect(options.nth(0)).toHaveAttribute('value', '')

    await expect(options.nth(1)).toHaveAttribute('value', 'holding')
    await expect(options.nth(1)).toHaveText(`Le ${site.groupe.nom} (général)`)

    for (const [index, filiale] of filiales.entries()) {
      const option = options.nth(index + 2)
      await expect(option).toHaveAttribute('value', filiale.slug)
      await expect(option).toHaveText(filiale.nom)
    }
  })

  // --- Critère 3 -----------------------------------------------------------------------------
  test('should show 4 errors, mark invalid fields aria-invalid, focus the first invalid field (Nom) and send no request on empty submit', async ({
    page,
  }) => {
    // Aucune requête n'est attendue ici (formulaire invalide bloqué côté client) : une IP
    // "sale" (laissée par un run précédent) n'a aucune incidence, pas besoin de résilience.
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': nextTestIp() })
    const requests = trackContactRequests(page)

    const contactPage = new ContactPage(page)
    await contactPage.goto()
    await contactPage.submitButton.click()

    await expect(contactPage.alerts).toHaveCount(4)
    await expect(contactPage.nomInput).toHaveAttribute('aria-invalid', 'true')
    await expect(contactPage.emailInput).toHaveAttribute('aria-invalid', 'true')
    await expect(contactPage.messageInput).toHaveAttribute('aria-invalid', 'true')

    await expect(contactPage.nomInput).toBeFocused()

    expect(requests, 'aucune requête ne doit partir vers /api/public/contact sur un formulaire invalide').toHaveLength(0)
  })

  // --- Critère 4 -----------------------------------------------------------------------------
  test('should reject the name "http://spam.example" client-side (no request sent)', async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': nextTestIp() })
    const requests = trackContactRequests(page)

    const contactPage = new ContactPage(page)
    await contactPage.goto()
    await contactPage.fillValid({
      nom: 'http://spam.example',
      email: 'jean@exemple.ca',
      cible: 'entretien',
      message: 'Message valide, assez long pour la validation côté client.',
    })
    await contactPage.submitButton.click()

    await expect(contactPage.alerts.first()).toBeVisible()
    expect(requests, 'un nom invalide ne doit jamais déclencher de requête réseau').toHaveLength(0)
  })

  test('should reject the name "http://spam.example" server-side (400) on a direct request bypassing the client', async ({
    request,
  }, testInfo) => {
    const email = makeTestEmail('nom-serveur', testInfo.project.name)
    const res = await postContactResilient(request, (ip) => ({
      headers: { 'x-forwarded-for': ip },
      data: validHoldingBody(email, { nom: 'http://spam.example' }),
    }))
    expect(res.status()).toBe(400)
  })

  // --- Critère 5 -----------------------------------------------------------------------------
  test('should show a success toast, clear the form and create a MessageContact visible via GET /api/admin/messages', async ({
    page,
    request,
    browser,
  }, testInfo) => {
    const email = makeTestEmail('succes', testInfo.project.name)
    const messageEnvoye = 'Bonjour, je souhaite obtenir un devis pour un contrat annuel.'

    const [sections, filiales] = await Promise.all([
      request.get('/api/public/sites/holding/sections?page=CONTACT').then((r) => r.json()) as Promise<ContactSectionsDto>,
      request.get('/api/public/sites').then((r) => r.json()) as Promise<PublicSiteSummaryDto[]>,
    ])
    const entretien = filiales.find((f) => f.slug === 'entretien')
    expect(entretien, 'la filiale entretien doit être seedée').toBeTruthy()
    expect(sections.contact, 'CONTACT:contact doit exister').toBeTruthy()

    const ip = await reserveFreshIp(request)
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': ip })
    const contactPage = new ContactPage(page)
    await contactPage.goto()
    await contactPage.fillValid({ nom: 'Jean Tremblay', email, cible: 'entretien', message: messageEnvoye })
    await contactPage.submitButton.click()

    await expect(page.getByText('Message envoyé')).toBeVisible()
    await expect(page.getByText(sections.contact!.messageSucces)).toBeVisible()

    await expect(contactPage.nomInput).toHaveValue('')
    await expect(contactPage.emailInput).toHaveValue('')
    await expect(contactPage.messageInput).toHaveValue('')
    await expect(contactPage.cibleSelect).toHaveValue('')

    const adminContext = await browser.newContext()
    try {
      await loginAs(adminContext, SUPER_ADMIN)
      const page = (await adminContext.request
        .get(`/api/admin/messages?q=${encodeURIComponent(email)}`)
        .then((r) => r.json())) as AdminPage<AdminMessageDto>
      const created = page.items.find((m) => m.email === email)
      expect(created, 'le message créé doit être visible via GET /api/admin/messages').toBeTruthy()
      expect(created!.site.slug).toBe('entretien')
      expect(created!.sujet).toBe(`Demande — ${entretien!.nom} (via le site du groupe)`)
      expect(created!.message).toBe(messageEnvoye)
      expect(created!.nom).toBe('Jean Tremblay')
    } finally {
      await adminContext.close()
    }
  })

  // --- Critère 6 : contrat API ---------------------------------------------------------------
  test('C6a — legacy body {companySlug, sujet, type} (no "formulaire") should be rejected with 400', async ({ request }, testInfo) => {
    const email = makeTestEmail('c6a', testInfo.project.name)
    const res = await postContactResilient(request, (ip) => ({
      headers: { 'x-forwarded-for': ip },
      data: {
        companySlug: 'entretien',
        sujet: 'Ancien contrat',
        type: 'SUGGESTION_PRODUIT',
        nom: 'Jean Tremblay',
        email,
        message: 'Message assez long pour respecter la borne minimale de validation.',
      },
    }))
    expect(res.status()).toBe(400)
  })

  test('C6b — an extra "sujet" key on an otherwise valid body should be rejected with 400 (.strict())', async ({ request }, testInfo) => {
    const email = makeTestEmail('c6b', testInfo.project.name)
    const res = await postContactResilient(request, (ip) => ({
      headers: { 'x-forwarded-for': ip },
      data: validHoldingBody(email, { sujet: 'Sujet fourni par le client' }),
    }))
    expect(res.status()).toBe(400)
  })

  test('C6c — an unknown "cible" should be rejected with 400', async ({ request }, testInfo) => {
    const email = makeTestEmail('c6c', testInfo.project.name)
    const res = await postContactResilient(request, (ip) => ({
      headers: { 'x-forwarded-for': ip },
      data: validHoldingBody(email, { cible: 'inconnue' }),
    }))
    expect(res.status()).toBe(400)
  })

  test('C6d — a NUL character (\\u0000) in "message" should be rejected with 400, never 500', async ({ request }, testInfo) => {
    const email = makeTestEmail('c6d', testInfo.project.name)
    const res = await postContactResilient(request, (ip) => ({
      headers: { 'x-forwarded-for': ip },
      data: validHoldingBody(email, { message: 'Bonjour\u0000 le monde, ceci contient un octet interdit.' }),
    }))
    expect(res.status()).toBe(400)
  })

  test('C6e — a text/plain content-type should be rejected with 415', async ({ request }, testInfo) => {
    const email = makeTestEmail('c6e', testInfo.project.name)
    const res = await postContactResilient(request, (ip) => ({
      headers: { 'x-forwarded-for': ip, 'content-type': 'text/plain' },
      data: JSON.stringify(validHoldingBody(email)),
    }))
    expect(res.status()).toBe(415)
  })

  test('C6f — a body over 32 KB should be rejected with 413', async ({ request }, testInfo) => {
    const email = makeTestEmail('c6f', testInfo.project.name)
    const res = await postContactResilient(request, (ip) => ({
      headers: { 'x-forwarded-for': ip },
      data: validHoldingBody(email, { message: 'a'.repeat(40_000) }),
    }))
    expect(res.status()).toBe(413)
  })

  test('C6g — a filled honeypot should return 201 without creating any MessageContact', async ({ request, browser }, testInfo) => {
    const email = makeTestEmail('c6g-honeypot', testInfo.project.name)
    const res = await postContactResilient(request, (ip) => ({
      headers: { 'x-forwarded-for': ip },
      data: validHoldingBody(email, { website: 'http://bot.example' }),
    }))
    expect(res.status()).toBe(201)
    expect(await res.json()).toEqual({ ok: true })

    const adminContext = await browser.newContext()
    try {
      await loginAs(adminContext, SUPER_ADMIN)
      const page = (await adminContext.request
        .get(`/api/admin/messages?q=${encodeURIComponent(email)}`)
        .then((r) => r.json())) as AdminPage<AdminMessageDto>
      expect(page.total, 'le honeypot ne doit jamais créer de MessageContact').toBe(0)
    } finally {
      await adminContext.close()
    }
  })

  test('C6h — a 6th request from the same IP within the window should return 429 with Retry-After', async ({ request }, testInfo) => {
    const email = makeTestEmail('c6h-rate-limit', testInfo.project.name)
    let statuses: number[] = []
    let lastHeaders: Record<string, string> = {}

    // Contrairement à `postContactResilient` (une seule requête), ce test A BESOIN d'une IP
    // vierge (0 hit) pour observer exactement 5 succès puis un 429 : si l'IP tirée porte déjà
    // des hits résiduels d'un run précédent, la salve entière est reprise sur une nouvelle IP.
    for (let attempt = 0; attempt < MAX_IP_RETRIES; attempt += 1) {
      const ip = nextTestIp()
      statuses = []
      let ipDejaEntamee = false

      for (let i = 0; i < 6; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const res = await request.post('/api/public/contact', {
          headers: { 'x-forwarded-for': ip },
          data: validHoldingBody(email),
        })
        statuses.push(res.status())
        lastHeaders = res.headers()
        if (i < 5 && res.status() === 429) {
          ipDejaEntamee = true
          break
        }
      }
      if (!ipDejaEntamee) break
    }

    expect(statuses).toEqual([201, 201, 201, 201, 201, 429])
    expect(lastHeaders['retry-after'], 'le 429 doit porter un en-tête Retry-After numérique').toMatch(/^\d+$/)
  })

  // --- Critère 7 -------------------------------------------------------------------------------
  test('should show an error toast and keep field values on a mocked 429 (Retry-After honored)', async ({ page }) => {
    await page.route('**/api/public/contact', async (route) => {
      if (route.request().method() !== 'POST') return route.continue()
      await route.fulfill({
        status: 429,
        headers: { 'retry-after': '120' },
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 429, statusMessage: 'Trop de tentatives, réessayez plus tard' }),
      })
    })

    const contactPage = new ContactPage(page)
    await contactPage.goto()
    const values = { nom: 'Jean Tremblay', email: 'jean@exemple.ca', cible: 'entretien', message: 'Message conservé après le 429.' }
    await contactPage.fillValid(values)
    await contactPage.submitButton.click()

    await expect(page.getByText('Trop d’envois depuis votre connexion.')).toBeVisible()
    await expect(page.getByText('Réessayez dans 2 minutes.')).toBeVisible()

    await expect(contactPage.nomInput).toHaveValue(values.nom)
    await expect(contactPage.emailInput).toHaveValue(values.email)
    await expect(contactPage.cibleSelect).toHaveValue(values.cible)
    await expect(contactPage.messageInput).toHaveValue(values.message)
  })

  test('should show an error toast and keep field values on a mocked 5xx', async ({ page, request }) => {
    const site = (await request.get('/api/public/sites/holding').then((r) => r.json())) as PublicSiteDto

    await page.route('**/api/public/contact', async (route) => {
      if (route.request().method() !== 'POST') return route.continue()
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 500, statusMessage: 'Erreur interne' }),
      })
    })

    const contactPage = new ContactPage(page)
    await contactPage.goto()
    const values = { nom: 'Jean Tremblay', email: 'jean@exemple.ca', cible: 'entretien', message: 'Message conservé après le 500.' }
    await contactPage.fillValid(values)
    await contactPage.submitButton.click()

    await expect(page.getByText('L’envoi a échoué. Réessayez dans un instant.')).toBeVisible()
    if (site.email) {
      await expect(page.getByText(`Vous pouvez aussi nous écrire à ${site.email}`)).toBeVisible()
    }

    await expect(contactPage.nomInput).toHaveValue(values.nom)
    await expect(contactPage.emailInput).toHaveValue(values.email)
    await expect(contactPage.cibleSelect).toHaveValue(values.cible)
    await expect(contactPage.messageInput).toHaveValue(values.message)
  })

  // --- Critère 8 -------------------------------------------------------------------------------
  test('should display groupe.mentionFormulaires interpolated, with a link to /confidentialite', async ({ page, request }) => {
    const site = (await request.get('/api/public/sites/holding').then((r) => r.json())) as PublicSiteDto
    expect(site.groupe.mentionFormulaires, 'COMMUN:mentionFormulaires (holding) doit exister').toBeTruthy()

    const contactPage = new ContactPage(page)
    await contactPage.goto()

    const texteAttendu = interpolerGroupe(site.groupe.mentionFormulaires!, site.groupe.nom)
    await expect(contactPage.form.getByText(texteAttendu)).toBeVisible()

    const lien = contactPage.form.getByRole('link', { name: 'Politique de confidentialité' })
    await expect(lien).toHaveAttribute('href', '/confidentialite')
  })

  // --- Critère 9 -------------------------------------------------------------------------------
  test('should fit within 375px width with all controls and the submit button >= 44px tall (mobile only)', async ({ page }) => {
    const viewport = page.viewportSize()
    test.skip(!viewport || viewport.width !== 375, "Ce critère ne s'applique qu'au viewport mobile (375px)")

    const contactPage = new ContactPage(page)
    const response = await contactPage.goto()
    expect(response?.status()).toBe(200)

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(scrollWidth).toBeLessThanOrEqual(375)

    const MIN_TOUCH_TARGET_PX = 44
    for (const control of [contactPage.nomInput, contactPage.emailInput, contactPage.cibleSelect, contactPage.messageInput, contactPage.submitButton]) {
      const box = await control.boundingBox()
      expect(box, 'chaque contrôle doit être mesurable').toBeTruthy()
      expect(box!.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX)
    }
  })

  test('should stay single-column at 768px with a full-width form (email placeholder not cramped)', async ({ page }, testInfo) => {
    // Aucun projet 768px n'est câblé sur ce spec (seuls mobile/desktop, cf. playwright.config.ts) :
    // on force la largeur dans le test plutôt que d'ajouter un 3e run complet du fichier.
    // Exécuté une seule fois (sur "desktop") pour ne pas dupliquer l'assertion.
    test.skip(testInfo.project.name !== 'desktop', 'Vérifié une seule fois (indépendant du viewport par défaut du projet)')

    await page.setViewportSize({ width: 768, height: 1024 })
    const contactPage = new ContactPage(page)
    await contactPage.goto()

    const MIN_FORM_WIDTH_PX = 550 // largeur attendue en colonne unique ; le bug prototype produisait ~330px (2 colonnes dès md)
    const MIN_EMAIL_WIDTH_PX = 200 // le bug prototype tronquait "vous@exemple" à ~140px
    const formBox = await contactPage.form.boundingBox()
    expect(formBox, 'le formulaire doit être mesurable').toBeTruthy()
    expect(formBox!.width).toBeGreaterThanOrEqual(MIN_FORM_WIDTH_PX)

    const emailBox = await contactPage.emailInput.boundingBox()
    expect(emailBox, "le champ courriel doit être mesurable").toBeTruthy()
    expect(emailBox!.width).toBeGreaterThanOrEqual(MIN_EMAIL_WIDTH_PX)
  })

  // --- Critère 10 ------------------------------------------------------------------------------
  test('should contain no computed CSS gradient background and no v-html marker in the T2 component files', async ({ page }) => {
    const contactPage = new ContactPage(page)
    const response = await contactPage.goto()
    expect(response?.status()).toBe(200)

    const gradientElementCount = await page.evaluate(() => {
      let count = 0
      document.querySelectorAll('*').forEach((el) => {
        if (getComputedStyle(el).backgroundImage.includes('gradient')) count += 1
      })
      return count
    })
    expect(gradientElementCount).toBe(0)

    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const filesToCheck = [
      'app/pages/contact.vue',
      'app/components/site/contact/ContactIntro.vue',
      'app/components/site/contact/HoldingContactForm.vue',
      'app/components/site/form/HoneypotField.vue',
      'app/components/site/form/MentionConfidentialite.vue',
    ]
    for (const relativePath of filesToCheck) {
      const content = readFileSync(join(process.cwd(), relativePath), 'utf-8')
      expect(content, `v-html trouvé dans ${relativePath}`).not.toMatch(/v-html/)
    }
  })

  // --- Critère 11 ------------------------------------------------------------------------------
  test('should reflect an admin edit of CONTACT:contact.titre on /contact immediately (ISR invalidation)', async ({
    page,
    browser,
  }) => {
    const adminContext = await browser.newContext()
    try {
      await loginAs(adminContext, SUPER_ADMIN)
      const rows = (await adminContext.request
        .get('/api/admin/contenu/sections?site=holding')
        .then((r) => r.json())) as AdminSectionRow[]
      const entry = rows.find((row) => row.page === 'CONTACT' && row.cle === 'contact')
      expect(entry, 'CONTACT:contact doit exister côté admin').toBeTruthy()
      contactSectionEntry = entry

      const marker = `Titre contact modifié E2E${Date.now()}`
      const patch = await adminContext.request.patch(`/api/admin/contenu/sections/${entry!.uuid}`, {
        data: { donnees: { ...entry!.donnees, titre: marker } },
      })
      expect(patch.ok(), await patch.text()).toBeTruthy()

      await page.setExtraHTTPHeaders({ 'x-forwarded-for': nextTestIp() })
      const contactPage = new ContactPage(page)
      // Navigation fraîche (pas de SPA) : preuve que la purge ISR a bien eu lieu.
      await contactPage.goto()
      await expect(contactPage.h1).toHaveText(marker)
    } finally {
      await adminContext.close()
    }
  })

  test.afterAll(async ({ browser }) => {
    if (!contactSectionEntry) return
    const adminContext = await browser.newContext()
    try {
      await loginAs(adminContext, SUPER_ADMIN)
      await adminContext.request.patch(`/api/admin/contenu/sections/${contactSectionEntry.uuid}`, {
        data: { donnees: contactSectionEntry.donnees },
      })
    } finally {
      await adminContext.close()
    }
  })

  test.afterAll(() => {
    if (contactTestEmails.length === 0) return
    const args = ['exec', 'tsx', 'scripts/cleanup-test-data.ts', ...contactTestEmails.flatMap((email) => ['--contact-email', email])]
    execFileSync('pnpm', args, { cwd: process.cwd(), stdio: 'inherit' })
  })

  // --- Régression a11y : le label doit désigner le <select> (bug corrigé 2026-09-26) ---
  test('the "Filiale concernée" label should target the <select>, not the FormControl <div> wrapper', async ({ page }) => {
    // FormControl (Slot reka-ui) doit envelopper directement le <select> : sinon id/aria-invalid/
    // aria-describedby atterrissent sur l'enrobage de l'icône et le label ne désigne aucun contrôle.
    const contactPage = new ContactPage(page)
    await contactPage.goto()

    const labelFor = await page.locator('label', { hasText: 'Filiale concernée' }).getAttribute('for')
    expect(labelFor, 'le label doit avoir un attribut "for"').toBeTruthy()
    const targetTagName = await page.locator(`#${labelFor}`).evaluate((el) => el.tagName)
    expect(
      targetTagName,
      'BUG app/components/site/contact/HoldingContactForm.vue:161-163 : le label "Filiale concernée" cible un <DIV> (wrapper FormControl), pas le <SELECT> — aucune association accessible entre le label et le contrôle réel.',
    ).toBe('SELECT')
  })
})
