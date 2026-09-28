// /{filiale}/contact — 6 formulaires filiale + suggestion de produit (spec
// docs/specs/lot2-contact-filiales.md §5 « T3, détail », §6). Contenu piloté à 100% par
// `CONTACT_FORMS`/`SUGGESTION_FORM` (shared/config/contact-forms.ts, source unique — spec §1) et
// par l'API des sections CONTACT (aucun texte marketing écrit en dur ici) : les valeurs attendues
// (H1, surtitre, messageSucces, libellés, options) sont toujours lues depuis la config partagée ou
// l'API publique avant d'être comparées au DOM. Exception assumée, comme dans contact.spec.ts :
// les libellés d'INTERFACE (bouton, titre de toast, messages de validation zod) sont du code, pas
// du contenu éditable.
//
// Isolation rate-limit (bucket 'contact' PARTAGÉ par les 6 formulaires + la suggestion, en mémoire
// serveur, spec §2) : même stratégie que contact.spec.ts — une IP TEST-NET tirée au hasard
// (203.0.113.x, RFC 5737) par soumission réelle, réessayée sur une IP fraîche en cas de 429
// résiduel (`postContactResilient`/`reserveFreshIp`, requêtes idempotentes). Un e-mail de test
// unique par soumission (quota de 3 accusés de réception par destinataire), nettoyé en `afterAll`
// via `pnpm exec tsx scripts/cleanup-test-data.ts --contact-email`.
import { execFileSync } from 'node:child_process'
import { test, expect, type Locator, type Page } from '@playwright/test'
import { loginAs, SUPER_ADMIN } from './helpers/auth'
import {
  CONTACT_FORMS,
  FORMULAIRES_FILIALES,
  SITES_SUGGESTION,
  SUGGESTION_FORM,
  estChampDetail,
  estSiteSuggestion,
  type ChampContact,
  type FormulaireFilialeSlug,
} from '#shared/config/contact-forms'
import { ajouterJoursIso, dateDuJourQuebec } from '#shared/utils/dates'

// --- Types DTO (contrats API, spec §1/§2/§6) ------------------------------------------------
interface PublicSiteDto {
  readonly nom: string
  readonly nomCourt: string | null
}

interface FormulaireSectionDto {
  readonly surtitre?: string
  readonly titre: string
  readonly texte?: string
  readonly messageSucces: string
}

interface ContactSectionsDto {
  readonly seo?: { readonly title: string; readonly description: string }
  readonly contact?: FormulaireSectionDto
  readonly suggestion?: FormulaireSectionDto
}

interface AdminMessageDto {
  readonly uuid: string
  readonly type: string
  readonly nom: string
  readonly email: string
  readonly telephone: string | null
  readonly entreprise: string | null
  readonly sujet: string
  readonly message: string
  readonly produitSouhaite: string | null
  readonly paysOrigine: string | null
  readonly details: Record<string, unknown>
  readonly company: { readonly slug: string }
}

// --- Interpolation locale (miroir minimal de shared/utils/texte.ts, comme contact.spec.ts et
// filiale-accueil.spec.ts — dupliqué plutôt qu'importé pour ne pas coupler ce test au module
// partagé). `plainTexte` retire les marqueurs `*accent*`/`\n` de TexteAccentue (H1, surtitre) ;
// le toast (usePublicFormFeedback) ne passe PAS par TexteAccentue, seule l'interpolation s'y
// applique (pas de `plainTexte`, voir usages ci-dessous). ------------------------------------
function interpolerVars(texte: string, vars: { nomCourt?: string | null; nom?: string | null }): string {
  return texte.replace(/\{(nomCourt|nom)\}/g, (correspondance, cle: 'nomCourt' | 'nom') => {
    const valeur = vars[cle]
    return valeur ? valeur : correspondance
  })
}
function plainTexte(texte: string): string {
  return texte.replace(/\*/g, '').replace(/\n/g, '')
}

// --- Isolation rate-limit : IP TEST-NET tirée au hasard par soumission (RFC 5737), voir
// contact.spec.ts pour la justification complète (bucket en mémoire partagé entre suites/runs). -
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

/** Corps JSON valide généré depuis CONTACT_FORMS[slug] — pour les requêtes API directes et la
 * sonde de `reserveFreshIp` (même logique de génération que tests/unit/contact-forms.test.ts). */
function valeurChamp(champ: ChampContact): string | number {
  switch (champ.type) {
    case 'nom':
      return 'Jean Tremblay'
    case 'email':
      return 'ignore@example.test' // toujours remplacé par l'appelant (e-mail unique par test)
    case 'telephone':
      return '514-555-0123'
    case 'entreprise':
      return 'Entreprise Test E2E'
    case 'message':
      return 'Message envoyé par la suite e2e contact-filiales, assez long pour la validation.'
    case 'texte':
      return `Valeur E2E ${champ.cle}`
    case 'date-future':
      return ajouterJoursIso(dateDuJourQuebec(), 7)
    case 'entier':
      return champ.min
    case 'select':
      return champ.options[0].value
  }
}

function corpsValideFiliale(slug: FormulaireFilialeSlug, email: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const cfg = CONTACT_FORMS[slug]
  const corps: Record<string, unknown> = {
    formulaire: slug,
    nom: 'Jean Tremblay',
    email,
    message: 'Message assez long pour la validation côté serveur (e2e contact-filiales).',
    website: '',
  }
  if (cfg.champs.some((c) => c.type === 'telephone')) corps.telephone = '514-555-0123'
  if (cfg.champs.some((c) => c.type === 'entreprise')) corps.entreprise = 'Entreprise Test E2E'
  const details: Record<string, unknown> = {}
  for (const champ of cfg.champs) {
    if (estChampDetail(champ)) details[champ.cle] = valeurChamp(champ)
  }
  return { ...corps, details, ...overrides }
}

/** `MessageContact.details` attendu côté admin : mêmes clés que le corps envoyé, `entier` en
 * nombre (coercion serveur), `formulaire` écrit en dernier par `handlerFiliale` (spec §2). */
function detailsAttendus(slug: FormulaireFilialeSlug): Record<string, string | number> {
  const details: Record<string, string | number> = {}
  for (const champ of CONTACT_FORMS[slug].champs) {
    if (!estChampDetail(champ)) continue
    const valeur = valeurChamp(champ)
    details[champ.cle] = champ.type === 'entier' ? Number(valeur) : String(valeur)
  }
  return { ...details, formulaire: slug }
}

/**
 * POST direct vers /api/public/contact, réessayé sur une IP fraîche si la réponse est 429 —
 * jamais parce que CE test dépasserait son propre quota (une seule requête), mais parce que l'IP
 * tirée porte l'état résiduel d'un run précédent de cette suite (ou de contact.spec.ts, même
 * bucket serveur partagé, spec §2).
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
    const probeEmail = `e2e-contact-filiales-probe-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`
    // eslint-disable-next-line no-await-in-loop
    const probe = await request.post('/api/public/contact', {
      headers: { 'x-forwarded-for': ip },
      data: corpsValideFiliale('entretien', probeEmail, { website: 'probe' }),
    })
    if (probe.status() !== 429) return ip
  }
  throw new Error('Impossible de réserver une IP de test (203.0.113.x) non limitée après plusieurs tentatives.')
}

// --- E-mails de test dédiés, nettoyés en afterAll -------------------------------------------
const contactTestEmails: string[] = []
function makeTestEmail(label: string, projectName: string): string {
  const email = `e2e-contact-filiales-${label}-${projectName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`
  contactTestEmails.push(email)
  return email
}

/** Requêtes du navigateur vers POST /api/public/contact — pour prouver l'absence d'appel. */
function trackContactRequests(page: Page): string[] {
  const urls: string[] = []
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('/api/public/contact')) urls.push(req.url())
  })
  return urls
}

// --- Page Object -----------------------------------------------------------------------------
class FilialeContactPage {
  constructor(private readonly page: Page) {}

  goto(slug: FormulaireFilialeSlug) {
    return this.page.goto(`/${slug}/contact`)
  }

  get h1(): Locator {
    return this.page.getByRole('heading', { level: 1 })
  }

  /**
   * Le bouton "Envoyer la demande" (COMMUN.bouton) est identique aux 6 configs de filiale et
   * distinct du bouton de suggestion ("Proposer ce produit", SUGGESTION_FORM.bouton) : sert à
   * isoler le <form> du contact filiale de celui de la suggestion de produit (rendu après, sur
   * ccdpaa/boissons uniquement) sans dépendre de l'ordre du DOM entre les 2 <form> de la page.
   */
  contactForm(slug: FormulaireFilialeSlug): Locator {
    return this.page.locator('form').filter({ has: this.page.getByRole('button', { name: CONTACT_FORMS[slug].bouton, exact: true }) })
  }

  suggestionForm(): Locator {
    return this.page.locator('form').filter({ has: this.page.getByRole('button', { name: SUGGESTION_FORM.bouton, exact: true }) })
  }
}

function champLocator(form: Locator, champ: ChampContact): Locator {
  return form.getByLabel(champ.label, { exact: true })
}

async function remplirFormulaireValide(form: Locator, champs: readonly ChampContact[], email: string): Promise<void> {
  for (const champ of champs) {
    const valeur = champ.type === 'email' ? email : String(valeurChamp(champ))
    const field = champLocator(form, champ)
    // eslint-disable-next-line no-await-in-loop
    if (champ.type === 'select') await field.selectOption(valeur)
    // eslint-disable-next-line no-await-in-loop
    else await field.fill(valeur)
  }
}

test.describe('/{filiale}/contact — 6 formulaires pilotés par CONTACT_FORMS + suggestion de produit', () => {
  // --- Rendu (§6 critères 1, 2, 5) + envoi vide (§6 critère 3) -------------------------------
  test('should render CONTACT_FORMS fields (order, labels, select options, non-selectable placeholder), H1/surtitre from CONTACT:contact, the suggestion form only for ccdpaa/boissons, and reject an empty submission with one error per field, focus on the first field and zero HTTP requests', async ({
    page,
    request,
  }) => {
    test.slow() // 6 filiales x (2 appels API + navigation + soumission vide) dans un seul test.
    // Aucune vraie requête POST n'est attendue ici (formulaire vide bloqué côté client) : une IP
    // déjà "sale" (run précédent) n'a aucune incidence, pas besoin de résilience.
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': nextTestIp() })

    for (const slug of FORMULAIRES_FILIALES) {
      const cfg = CONTACT_FORMS[slug]
      // eslint-disable-next-line no-await-in-loop
      const [sections, site] = await Promise.all([
        request.get(`/api/public/sites/${slug}/sections?page=CONTACT`).then((r) => r.json()) as Promise<ContactSectionsDto>,
        request.get(`/api/public/sites/${slug}`).then((r) => r.json()) as Promise<PublicSiteDto>,
      ])
      expect(sections.contact, `CONTACT:contact doit exister pour ${slug}`).toBeTruthy()
      const contact = sections.contact!
      const vars = { nomCourt: site.nomCourt ?? site.nom, nom: site.nom }

      const filialePage = new FilialeContactPage(page)
      const requests = trackContactRequests(page)
      // eslint-disable-next-line no-await-in-loop
      const response = await filialePage.goto(slug)
      expect(response?.status(), `GET /${slug}/contact doit répondre 200`).toBe(200)

      // --- H1 / surtitre (attentes depuis CONTACT:contact, spec §5 T3) ---------------------
      // eslint-disable-next-line no-await-in-loop
      await expect(filialePage.h1).toHaveCount(1)
      // eslint-disable-next-line no-await-in-loop
      await expect(filialePage.h1).toHaveText(plainTexte(interpolerVars(contact.titre, vars)))
      if (contact.surtitre) {
        const introContainer = filialePage.h1.locator('..')
        // eslint-disable-next-line no-await-in-loop
        await expect(introContainer.getByText(plainTexte(interpolerVars(contact.surtitre, vars)), { exact: true })).toBeVisible()
      }

      // --- Champs : ordre, libellés (§6 critère 2) -----------------------------------------
      const form = filialePage.contactForm(slug)
      // eslint-disable-next-line no-await-in-loop
      const labels = (await form.locator('label').allTextContents())
        .map((t) => t.trim())
        .filter((t) => t !== 'Ne pas remplir ce champ') // label caché du honeypot (website), hors config
      expect(labels, `ordre/libellés des champs de ${slug}`).toEqual(cfg.champs.map((c) => c.label))

      // --- Options des <select> (§6 critère 2) : invite non sélectionnable, options = config -
      for (const champ of cfg.champs) {
        if (champ.type !== 'select') continue
        const select = champLocator(form, champ)
        const options = select.locator('option')
        // eslint-disable-next-line no-await-in-loop
        await expect(options).toHaveCount(champ.options.length + 1)
        // eslint-disable-next-line no-await-in-loop
        await expect(options.nth(0)).toHaveText('Sélectionnez une option')
        // eslint-disable-next-line no-await-in-loop
        await expect(options.nth(0)).toBeDisabled()
        // eslint-disable-next-line no-await-in-loop
        await expect(options.nth(0)).toHaveAttribute('value', '')
        for (const [index, option] of champ.options.entries()) {
          // eslint-disable-next-line no-await-in-loop
          await expect(options.nth(index + 1)).toHaveAttribute('value', option.value)
          // eslint-disable-next-line no-await-in-loop
          await expect(options.nth(index + 1)).toHaveText(option.label)
        }
      }

      // --- Suggestion : présente seulement pour ccdpaa/boissons (§6 critère 5) --------------
      // eslint-disable-next-line no-await-in-loop
      const suggestionButtonCount = await page.getByRole('button', { name: SUGGESTION_FORM.bouton }).count()
      expect(suggestionButtonCount, `formulaire de suggestion sur /${slug}/contact`).toBe(estSiteSuggestion(slug) ? 1 : 0)

      // --- Envoi vide : une erreur par champ, focus sur le 1er, 0 requête (§6 critère 3) ----
      // eslint-disable-next-line no-await-in-loop
      await form.getByRole('button', { name: /Envoyer la demande|Envoi en cours/ }).click()
      // eslint-disable-next-line no-await-in-loop
      await expect(form.getByRole('alert')).toHaveCount(cfg.champs.length)
      const premierChamp = champLocator(form, cfg.champs[0])
      // eslint-disable-next-line no-await-in-loop
      await expect(premierChamp).toHaveAttribute('aria-invalid', 'true')
      // eslint-disable-next-line no-await-in-loop
      await expect(premierChamp).toBeFocused()
      expect(requests, `aucune requête ne doit partir vers /api/public/contact sur /${slug}/contact (formulaire vide)`).toHaveLength(0)
    }
  })

  // --- Envoi valide : toast, formulaire vidé, MessageContact conforme (§6 critère 4) ---------
  test('should show a success toast, clear the form and persist a MessageContact matching CONTACT_FORMS (sujet, telephone, entreprise, details) for each of the 6 subsidiaries', async ({
    page,
    request,
    browser,
  }, testInfo) => {
    test.slow() // 6 filiales x (2 appels API + réservation IP + soumission + vérif admin).

    for (const slug of FORMULAIRES_FILIALES) {
      const cfg = CONTACT_FORMS[slug]
      const email = makeTestEmail(`succes-${slug}`, testInfo.project.name)
      // eslint-disable-next-line no-await-in-loop
      const [sections, site] = await Promise.all([
        request.get(`/api/public/sites/${slug}/sections?page=CONTACT`).then((r) => r.json()) as Promise<ContactSectionsDto>,
        request.get(`/api/public/sites/${slug}`).then((r) => r.json()) as Promise<PublicSiteDto>,
      ])
      expect(sections.contact, `CONTACT:contact doit exister pour ${slug}`).toBeTruthy()
      const vars = { nomCourt: site.nomCourt ?? site.nom, nom: site.nom }

      // eslint-disable-next-line no-await-in-loop
      const ip = await reserveFreshIp(request)
      // eslint-disable-next-line no-await-in-loop
      await page.setExtraHTTPHeaders({ 'x-forwarded-for': ip })
      const filialePage = new FilialeContactPage(page)
      // eslint-disable-next-line no-await-in-loop
      await filialePage.goto(slug)
      const form = filialePage.contactForm(slug)
      // eslint-disable-next-line no-await-in-loop
      await remplirFormulaireValide(form, cfg.champs, email)
      // eslint-disable-next-line no-await-in-loop
      await form.getByRole('button', { name: /Envoyer la demande|Envoi en cours/ }).click()

      // eslint-disable-next-line no-await-in-loop
      await expect(page.getByText(cfg.toastTitre)).toBeVisible()
      // Le toast (usePublicFormFeedback) interpole {nomCourt}/{nom} mais ne passe PAS par
      // TexteAccentue (pas de rendu *accent*/\n) : pas de `plainTexte` ici, contrairement au H1.
      // eslint-disable-next-line no-await-in-loop
      await expect(page.getByText(interpolerVars(sections.contact!.messageSucces, vars))).toBeVisible()

      for (const champ of cfg.champs) {
        // eslint-disable-next-line no-await-in-loop
        const valeur = await champLocator(form, champ).inputValue()
        expect(valeur, `${slug}.${champ.label} doit être vidé après succès`).toBe('')
      }

      // eslint-disable-next-line no-await-in-loop
      const adminContext = await browser.newContext()
      try {
        // eslint-disable-next-line no-await-in-loop
        await loginAs(adminContext, SUPER_ADMIN)
        // eslint-disable-next-line no-await-in-loop
        const messages = (await adminContext.request.get('/api/admin/messages').then((r) => r.json())) as AdminMessageDto[]
        const created = messages.find((m) => m.email === email)
        expect(created, `le message ${slug} doit être visible via GET /api/admin/messages`).toBeTruthy()
        expect(created!.company.slug).toBe(slug)
        expect(created!.type).toBe('CONTACT')
        expect(created!.sujet).toBe(cfg.sujet)
        expect(created!.telephone).toBe(cfg.champs.some((c) => c.type === 'telephone') ? '514-555-0123' : null)
        expect(created!.entreprise).toBe(cfg.champs.some((c) => c.type === 'entreprise') ? 'Entreprise Test E2E' : null)
        expect(created!.details).toEqual(detailsAttendus(slug))
      } finally {
        // eslint-disable-next-line no-await-in-loop
        await adminContext.close()
      }
    }
  })

  // --- Suggestion : ccdpaa et boissons (§6 critère 5) -----------------------------------------
  test('ccdpaa and boissons: submitting the suggestion form should create a SUGGESTION_PRODUIT message (produitSouhaite, paysOrigine)', async ({
    page,
    request,
    browser,
  }, testInfo) => {
    for (const site of SITES_SUGGESTION) {
      const email = makeTestEmail(`suggestion-${site}`, testInfo.project.name)
      // eslint-disable-next-line no-await-in-loop
      const [sections, siteDto] = await Promise.all([
        request.get(`/api/public/sites/${site}/sections?page=CONTACT`).then((r) => r.json()) as Promise<ContactSectionsDto>,
        request.get(`/api/public/sites/${site}`).then((r) => r.json()) as Promise<PublicSiteDto>,
      ])
      expect(sections.suggestion, `CONTACT:suggestion doit exister pour ${site}`).toBeTruthy()
      const vars = { nomCourt: siteDto.nomCourt ?? siteDto.nom, nom: siteDto.nom }

      // eslint-disable-next-line no-await-in-loop
      const ip = await reserveFreshIp(request)
      // eslint-disable-next-line no-await-in-loop
      await page.setExtraHTTPHeaders({ 'x-forwarded-for': ip })
      const filialePage = new FilialeContactPage(page)
      // eslint-disable-next-line no-await-in-loop
      await filialePage.goto(site)

      const suggestionForm = filialePage.suggestionForm()
      const produitAttendu = 'Produit E2E'
      const paysAttendu = 'Mali'
      // eslint-disable-next-line no-await-in-loop
      await suggestionForm.getByLabel('Nom', { exact: true }).fill('Awa Diallo')
      // eslint-disable-next-line no-await-in-loop
      await suggestionForm.getByLabel('Courriel', { exact: true }).fill(email)
      // eslint-disable-next-line no-await-in-loop
      await suggestionForm.getByLabel('Produit souhaité', { exact: true }).fill(produitAttendu)
      // eslint-disable-next-line no-await-in-loop
      await suggestionForm.getByLabel('Pays d’origine', { exact: true }).fill(paysAttendu)
      // eslint-disable-next-line no-await-in-loop
      await suggestionForm.getByLabel('Pourquoi ce produit ?', { exact: true }).fill('Demande e2e, message assez long pour la validation.')
      // eslint-disable-next-line no-await-in-loop
      await suggestionForm.getByRole('button', { name: /Proposer ce produit|Envoi en cours/ }).click()

      // eslint-disable-next-line no-await-in-loop
      await expect(page.getByText(SUGGESTION_FORM.toastTitre)).toBeVisible()
      // eslint-disable-next-line no-await-in-loop
      await expect(page.getByText(interpolerVars(sections.suggestion!.messageSucces, vars))).toBeVisible()

      // eslint-disable-next-line no-await-in-loop
      const adminContext = await browser.newContext()
      try {
        // eslint-disable-next-line no-await-in-loop
        await loginAs(adminContext, SUPER_ADMIN)
        // eslint-disable-next-line no-await-in-loop
        const messages = (await adminContext.request.get('/api/admin/messages').then((r) => r.json())) as AdminMessageDto[]
        const created = messages.find((m) => m.email === email)
        expect(created, `la suggestion ${site} doit être visible via GET /api/admin/messages`).toBeTruthy()
        expect(created!.company.slug).toBe(site)
        expect(created!.type).toBe('SUGGESTION_PRODUIT')
        expect(created!.sujet).toBe(SUGGESTION_FORM.sujet)
        expect(created!.produitSouhaite).toBe(produitAttendu)
        expect(created!.paysOrigine).toBe(paysAttendu)
        expect(created!.details).toEqual({ formulaire: 'suggestion' })
      } finally {
        // eslint-disable-next-line no-await-in-loop
        await adminContext.close()
      }
    }
  })

  // --- Rejets serveur (§6 critère 6, spec T0) --------------------------------------------------
  test('direct API: an unknown details key, a "formulaire" key inside details, a suggestion for a mismatched site and a past transport date should all be rejected with 400, never 500', async ({
    request,
  }, testInfo) => {
    const emailDetailsInconnu = makeTestEmail('400-details-inconnu', testInfo.project.name)
    const corpsInconnu = corpsValideFiliale('entretien', emailDetailsInconnu)
    const resInconnu = await postContactResilient(request, (ip) => ({
      headers: { 'x-forwarded-for': ip },
      data: { ...corpsInconnu, details: { ...(corpsInconnu.details as object), inconnu: 'x' } },
    }))
    expect(resInconnu.status(), 'une clé "details" inconnue doit être rejetée').toBe(400)

    const emailFormulaireDansDetails = makeTestEmail('400-formulaire-dans-details', testInfo.project.name)
    const corpsFormulaire = corpsValideFiliale('entretien', emailFormulaireDansDetails)
    const resFormulaire = await postContactResilient(request, (ip) => ({
      headers: { 'x-forwarded-for': ip },
      data: { ...corpsFormulaire, details: { ...(corpsFormulaire.details as object), formulaire: 'x' } },
    }))
    expect(resFormulaire.status(), 'la clé "formulaire" ne doit jamais être acceptée dans "details" (réservée au serveur)').toBe(400)

    const emailSuggestionMismatch = makeTestEmail('400-suggestion-mismatch', testInfo.project.name)
    const resSuggestion = await postContactResilient(request, (ip) => ({
      headers: { 'x-forwarded-for': ip },
      data: {
        formulaire: 'suggestion',
        site: 'entretien', // 'entretien' n'est ni ccdpaa ni boissons
        nom: 'Jean Tremblay',
        email: emailSuggestionMismatch,
        produitSouhaite: 'Produit test',
        paysOrigine: 'Mali',
        message: 'Message assez long pour la validation côté serveur (e2e contact-filiales).',
        website: '',
      },
    }))
    expect(resSuggestion.status(), 'une suggestion pour un site autre que ccdpaa/boissons doit être rejetée').toBe(400)

    const emailDatePassee = makeTestEmail('400-date-passee', testInfo.project.name)
    const corpsTransport = corpsValideFiliale('transport', emailDatePassee)
    const resDate = await postContactResilient(request, (ip) => ({
      headers: { 'x-forwarded-for': ip },
      data: {
        ...corpsTransport,
        details: { ...(corpsTransport.details as object), dateSouhaitee: ajouterJoursIso(dateDuJourQuebec(), -1) },
      },
    }))
    expect(resDate.status(), 'une date de transport passée (hier) doit être rejetée').toBe(400)
  })

  // --- Layout 375px (§6 critère 8, mobile only) -------------------------------------------------
  test('at 375px, the subsidiary contact page has no horizontal scroll and controls are >= 44px tall (mobile only)', async ({ page }) => {
    const viewport = page.viewportSize()
    test.skip(!viewport || viewport.width !== 375, "Ce critère ne s'applique qu'au viewport mobile (375px)")

    // Échantillon unique (placement : nom/entreprise/email/téléphone/select/entier/message) — les
    // 6 formulaires partagent le même composant ChampContact/FilialeContactForm (spec §4), tester
    // un représentant suffit à couvrir le risque de régression de mise en page.
    const slug: FormulaireFilialeSlug = 'placement'
    const filialePage = new FilialeContactPage(page)
    const response = await filialePage.goto(slug)
    expect(response?.status()).toBe(200)

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(scrollWidth).toBeLessThanOrEqual(375)

    const MIN_TOUCH_TARGET_PX = 44
    const form = filialePage.contactForm(slug)
    for (const champ of CONTACT_FORMS[slug].champs) {
      if (champ.type === 'message') continue // textarea : hauteur pilotée par `rows`, pas une cible tactile ponctuelle
      const box = await champLocator(form, champ).boundingBox()
      expect(box, `${champ.label} doit être mesurable`).toBeTruthy()
      expect(box!.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX)
    }
    const submitBox = await form.getByRole('button', { name: /Envoyer la demande|Envoi en cours/ }).boundingBox()
    expect(submitBox, "le bouton d'envoi doit être mesurable").toBeTruthy()
    expect(submitBox!.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX)
  })

  // --- Layout 768px (§6 critère 8, spec §5 T3) --------------------------------------------------
  // NB e2e-tester : la grille interne des champs (`grid-cols-1 lg:grid-cols-2`, ChampContact par
  // paires — Nom/Entreprise, Courriel/Téléphone…) reste à 2 colonnes à 768px (lg = 1024px, comme
  // le formulaire holding, `sm:grid-cols-2` @640px, qui pair déjà Nom/Courriel à cette largeur) :
  // c'est le comportement voulu, pas le bug du prototype. Le critère « une colonne » porte sur la
  // mise en page EXTÉRIEURE (ContactIntro | FilialeContactForm, `lg:grid-cols-12`) — même grille,
  // même seuil que contact.spec.ts « should stay single-column at 768px » (holding).
  test('at 768px, the outer layout (intro + form) stays single-column with a full-width form card', async ({ page }, testInfo) => {
    // Aucun projet 768px n'est câblé sur ce spec (seuls mobile/desktop, playwright.config.ts) : on
    // force la largeur plutôt que d'ajouter un run complet. Vérifié une seule fois (sur "desktop").
    test.skip(testInfo.project.name !== 'desktop', "Vérifié une seule fois (indépendant du viewport par défaut du projet)")

    await page.setViewportSize({ width: 768, height: 1024 })
    const slug: FormulaireFilialeSlug = 'placement'
    const filialePage = new FilialeContactPage(page)
    await filialePage.goto(slug)
    const form = filialePage.contactForm(slug)

    const MIN_FORM_WIDTH_PX = 550 // même seuil que contact.spec.ts (bug prototype : ~330px en 2 colonnes dès md)
    const formBox = await form.boundingBox()
    expect(formBox, 'le formulaire doit être mesurable').toBeTruthy()
    expect(formBox!.width).toBeGreaterThanOrEqual(MIN_FORM_WIDTH_PX)

    const h1Box = await filialePage.h1.boundingBox()
    expect(h1Box, 'le H1 doit être mesurable').toBeTruthy()
    // Colonne unique : le formulaire est sous l'intro (même colonne x), jamais à côté (2 colonnes).
    expect(formBox!.y, "le formulaire doit être sous le H1 (empilé), pas à côté").toBeGreaterThan(h1Box!.y)
    expect(Math.abs(formBox!.x - h1Box!.x), 'le formulaire doit partager la même colonne x que le H1 (pas 2 colonnes)').toBeLessThan(4)
  })

  test.afterAll(() => {
    if (contactTestEmails.length === 0) return
    const args = ['exec', 'tsx', 'scripts/cleanup-test-data.ts', ...contactTestEmails.flatMap((email) => ['--contact-email', email])]
    execFileSync('pnpm', args, { cwd: process.cwd(), stdio: 'inherit' })
  })
})
