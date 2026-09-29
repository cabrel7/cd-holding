// /placement/offres, /placement/offres/[uuid], /placement/offres/candidature-spontanee (spec
// docs/specs/lot3-pages-specifiques.md §3, §5 T3, §6 critères 1-5, 6 partiel, 11). Exécuté contre
// le BUILD DE PRODUCTION (voir playwright.config.ts).
//
// Données : la base de dev n'a aucune offre publiée. Deux offres de test sont créées en
// `beforeAll` (scripts/cleanup-test-data.ts --creer-offre, marqueur « E2E » dans
// `entrepriseCliente`) et supprimées en `afterAll` avec toutes les candidatures / Fichier / objets
// stockés créés (--candidature-email, --offre-titre). Aucune assertion sur le texte exact des
// sections éditables (OFFRES:cta/candidature/spontanee : seed en amorçage seulement, la base de
// dev peut en manquer ou les avoir anciennes) : seuls les libellés d'INTERFACE (boutons, titres de
// toast, messages zod) sont du code et sont assertés.
//
// Isolation rate-limit : un x-forwarded-for 203.0.113.x distinct par test (candidature 3/h/IP).
// Le critère 375 px (mobile) est porté par un `test.use({ viewport })` local : ce fichier ne
// tourne que sur le projet « desktop » de playwright.config.ts.
import { test, expect, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { CANDIDATURE_FORM, POSTES_CANDIDAT } from '#shared/config/candidature'
import { nextTestIp } from './helpers/ip'
import {
  compterFichiersPlacement,
  creerOffreTest,
  inspecterCandidature,
  nettoyer,
  retirerOffreTest,
} from './helpers/db'
import { CV_PDF_PATH, FAUX_PDF_PATH, cvPdfBuffer, ecrireFichierVolumineux, fauxPdfBuffer, pdfVolumineux } from './helpers/upload-files'

const UUID_INCONNU = '01a0ea1f-0000-7000-8000-000000000000'
const CLE_PUBLIQUE_OFFRE = ['description', 'lieu', 'publieeLe', 'salaire', 'titre', 'typeContrat', 'uuid']
const SECRETS_OFFRE = ['Client Secret E2E', 'Contact Secret E2E', 'contact-secret-e2e@example.test', '514-555-0199', 'Description interne e2e']
const HTTP = { ok: 200, created: 201, badRequest: 400, unauthorized: 401, notFound: 404, tooLarge: 413, unsupported: 415, tooMany: 429 } as const
const TOAST_FICHIER_REFUSE = 'Fichier refusé'
const VIEWPORT_MOBILE = { width: 375, height: 812 } as const
const MIN_TARGET_PX = 44

const suffixe = Date.now()
const TITRE_OFFRE = `Offre E2E lot3 ${suffixe}`
const TITRE_OFFRE_RETIREE = `Offre E2E retiree ${suffixe}`
let offreUuid = ''
let offreRetireeUuid = ''
const candidatureEmails: string[] = []

function emailTest(label: string): string {
  const email = `e2e-lot3-cand-${label}-${suffixe}-${Math.random().toString(36).slice(2, 7)}@example.test`
  candidatureEmails.push(email)
  return email
}

/** Corps multipart valide (candidature spontanée par défaut) pour les appels API directs. */
function champsApi(email: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    nom: 'Jean Tremblay',
    email,
    telephone: '514-555-0123',
    adresseComplete: '1234 rue Exemple, Montréal (Québec) H1H 1H1',
    pays: 'Canada',
    posteRecherche: 'manutention',
    experience: 'UN_A_TROIS_ANS',
    consentement: 'true',
    ...extra,
  }
}

async function postCandidature(
  request: APIRequestContext,
  ip: string,
  champs: Record<string, string>,
  fichiers: Record<string, { name: string; mimeType: string; buffer: Buffer }> = {
    cv: { name: 'cv.pdf', mimeType: 'application/pdf', buffer: cvPdfBuffer() },
  },
) {
  return request.post('/api/public/placement/candidatures', {
    headers: { 'x-forwarded-for': ip },
    multipart: { ...champs, ...fichiers },
  })
}

// --- Page Objects ----------------------------------------------------------------------------
class OffresListePage {
  constructor(private readonly page: Page) {}
  goto() {
    return this.page.goto('/placement/offres')
  }
  get h1(): Locator {
    return this.page.getByRole('heading', { level: 1 })
  }
  ligne(titre: string): Locator {
    return this.page.getByRole('article').filter({ has: this.page.getByRole('heading', { name: titre }) })
  }
}

class CandidaturePage {
  constructor(private readonly page: Page) {}
  gotoSpontanee() {
    return this.page.goto('/placement/offres/candidature-spontanee')
  }
  gotoOffre(uuid: string) {
    return this.page.goto(`/placement/offres/${uuid}`)
  }
  get form(): Locator {
    return this.page.locator('form').filter({ has: this.page.getByRole('button', { name: CANDIDATURE_FORM.bouton }) })
  }
  get nom(): Locator { return this.form.getByLabel('Nom complet', { exact: true }) }
  get email(): Locator { return this.form.getByLabel('Courriel', { exact: true }) }
  get telephone(): Locator { return this.form.getByLabel('Téléphone', { exact: true }) }
  get pays(): Locator { return this.form.getByLabel('Pays', { exact: true }) }
  get adresse(): Locator { return this.form.getByLabel('Adresse complète', { exact: true }) }
  get poste(): Locator { return this.form.getByLabel('Poste recherché', { exact: true }) }
  get precision(): Locator { return this.form.getByLabel('Précisez le poste', { exact: true }) }
  get experience(): Locator { return this.form.getByLabel('Expérience', { exact: true }) }
  get cv(): Locator { return this.form.getByLabel('Curriculum vitæ (CV)', { exact: true }) }
  get documents(): Locator { return this.form.getByLabel('Autres documents (optionnel)', { exact: true }) }
  get consentement(): Locator { return this.form.getByRole('checkbox') }
  get envoyer(): Locator { return this.form.getByRole('button', { name: CANDIDATURE_FORM.bouton }) }

  async attendreHydratation() {
    await expect(this.envoyer).toBeEnabled()
  }

  async remplir(email: string, options: { avecPoste: boolean; cvPath?: string }) {
    await this.attendreHydratation()
    await this.nom.fill('Jean Tremblay')
    await this.email.fill(email)
    await this.telephone.fill('514-555-0123')
    await this.pays.fill('Canada')
    await this.adresse.fill('1234 rue Exemple, Montréal (Québec) H1H 1H1')
    if (options.avecPoste) await this.poste.selectOption('manutention')
    await this.experience.selectOption('UN_A_TROIS_ANS')
    await this.cv.setInputFiles(options.cvPath ?? CV_PDF_PATH)
    await this.consentement.check()
  }
}

/** Requêtes POST du navigateur vers l'API de candidature — preuve d'absence / d'unicité d'appel. */
function suivreCandidatures(page: Page): string[] {
  const urls: string[] = []
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('/api/public/placement/candidatures')) urls.push(req.url())
  })
  return urls
}

/** Clés (récursives) d'un JSON — pour vérifier qu'aucun champ interne n'est exposé. */
function toutesLesCles(valeur: unknown, sortie: Set<string> = new Set()): Set<string> {
  if (Array.isArray(valeur)) valeur.forEach((v) => toutesLesCles(v, sortie))
  else if (valeur && typeof valeur === 'object') {
    for (const [k, v] of Object.entries(valeur)) {
      sortie.add(k)
      toutesLesCles(v, sortie)
    }
  }
  return sortie
}

test.describe('placement — offres, détail, candidatures', () => {
  test.beforeAll(() => {
    test.setTimeout(300_000)
    offreUuid = creerOffreTest(TITRE_OFFRE)
    offreRetireeUuid = creerOffreTest(TITRE_OFFRE_RETIREE)
  })

  test.afterAll(() => {
    test.setTimeout(300_000)
    nettoyer({ candidatureEmails, offreTitres: [TITRE_OFFRE, TITRE_OFFRE_RETIREE] })
  })

  test.beforeEach(async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': nextTestIp() })
  })

  // --- §6 critère 1 : 200 des 3 routes placement + 404 ------------------------------------------
  test('should answer 200 on the list, the offer detail and the spontaneous application page, and 404 on an unknown or malformed uuid', async ({ page, request }) => {
    const liste = new OffresListePage(page)
    for (const chemin of ['/placement/offres', `/placement/offres/${offreUuid}`, '/placement/offres/candidature-spontanee']) {
      const res = await request.get(chemin)
      expect(res.status(), chemin).toBe(HTTP.ok)
    }
    await liste.goto()
    await expect(liste.h1).toBeVisible()
    await expect(liste.h1).not.toBeEmpty()

    await page.goto(`/placement/offres/${offreUuid}`)
    await expect(page.getByRole('heading', { level: 1, name: TITRE_OFFRE })).toBeVisible()

    for (const chemin of [`/placement/offres/${UUID_INCONNU}`, '/placement/offres/pas-un-uuid']) {
      const res = await request.get(chemin)
      expect(res.status(), chemin).toBe(HTTP.notFound)
    }
    // API : uuid malformé = 400 (jamais une 500 Postgres), inconnu = 404.
    expect((await request.get('/api/public/placement/offres/pas-un-uuid')).status()).toBe(HTTP.badRequest)
    expect((await request.get(`/api/public/placement/offres/${UUID_INCONNU}`)).status()).toBe(HTTP.notFound)
  })

  test('should list the test offer with a « Postuler » link to its detail page and a positive open-positions counter', async ({ page }) => {
    const liste = new OffresListePage(page)
    await liste.goto()
    const ligne = liste.ligne(TITRE_OFFRE)
    await expect(ligne).toBeVisible()
    await expect(ligne.getByText('Laval (Québec)')).toBeVisible()
    await expect(ligne.getByText('Temps plein')).toBeVisible()
    await expect(page.getByText(/^\d+ postes? ouverts?$/)).toBeVisible()
    await ligne.getByRole('link', { name: 'Postuler' }).click()
    await expect(page).toHaveURL(new RegExp(`/placement/offres/${offreUuid}$`))
    await expect(page.getByRole('heading', { level: 1, name: TITRE_OFFRE })).toBeVisible()
  })

  test('should not expose the nav « Offres » link as a 404 (desktop nav and mobile menu)', async ({ page }) => {
    await page.goto('/placement')
    if ((page.viewportSize()?.width ?? 1440) < 768) await page.getByRole('button', { name: 'Menu' }).click()
    const lien = page.getByRole('link', { name: 'Offres', exact: true }).first()
    await expect(lien).toBeVisible()
    await lien.click()
    await expect(page).toHaveURL(/\/placement\/offres$/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText(/introuvable|404/i)).toHaveCount(0)
  })

  // --- §6 critère 2 : rien d'interne dans les réponses publiques --------------------------------
  test('should expose only the public fields (no id, entrepriseCliente, contact*, file key) in the API and in the rendered pages', async ({ request }) => {
    const liste = await request.get('/api/public/placement/offres')
    expect(liste.status()).toBe(HTTP.ok)
    const offres = (await liste.json()) as Record<string, unknown>[]
    const notre = offres.find((o) => o.titre === TITRE_OFFRE)
    expect(notre, 'notre offre est publiée').toBeTruthy()
    for (const o of offres) expect(Object.keys(o).sort()).toEqual(CLE_PUBLIQUE_OFFRE)

    const detail = await request.get(`/api/public/placement/offres/${offreUuid}`)
    const corps = (await detail.json()) as Record<string, unknown>
    expect(Object.keys(corps).sort()).toEqual(CLE_PUBLIQUE_OFFRE)
    const cles = [...toutesLesCles(corps), ...toutesLesCles(offres)]
    for (const interdite of ['id', 'entrepriseCliente', 'companyId', 'demandeId', 'contactNom', 'contactEmail', 'contactTelephone', 'cvKey']) {
      expect(cles, interdite).not.toContain(interdite)
    }

    // Rendu HTML (SSR) : aucun secret, JSON-LD JobPosting compris.
    for (const chemin of ['/placement/offres', `/placement/offres/${offreUuid}`]) {
      const html = await (await request.get(chemin)).text()
      for (const secret of SECRETS_OFFRE) expect(html, `${chemin} ne contient pas « ${secret} »`).not.toContain(secret)
    }
    const htmlDetail = await (await request.get(`/api/public/placement/offres/${offreUuid}`)).text()
    expect(htmlDetail).not.toMatch(/entrepriseCliente|contactEmail/)
  })

  // --- §6 critère 3 : validation client ----------------------------------------------------------
  test('should reject an empty submission client-side: one error per required field, focus on the first invalid field and zero HTTP request', async ({ page }) => {
    const c = new CandidaturePage(page)
    const posts = suivreCandidatures(page)
    await c.gotoSpontanee()
    await c.attendreHydratation()
    await c.envoyer.click()

    await expect(c.nom).toBeFocused()
    await expect(c.nom).toHaveAttribute('aria-invalid', 'true')
    for (const champ of [c.email, c.telephone, c.pays, c.adresse, c.experience, c.cv]) {
      await expect(champ).toHaveAttribute('aria-invalid', 'true')
    }
    await expect(c.consentement).toHaveAttribute('aria-invalid', 'true')
    await expect(c.form.getByText('Votre consentement est requis pour traiter votre candidature.')).toBeVisible()
    expect(posts).toHaveLength(0)
  })

  test('should flag the required position on an empty submission (not only once every other field is valid)', async ({ page }) => {
    const c = new CandidaturePage(page)
    await c.gotoSpontanee()
    await c.attendreHydratation()
    await c.envoyer.click()
    await expect(c.form.getByText('Sélectionnez un poste.')).toBeVisible()
    await expect(c.poste).toHaveAttribute('aria-invalid', 'true')
  })

  test('should require a precision when the position is « Autre » and hide the position fields on an offer page', async ({ page }) => {
    const c = new CandidaturePage(page)
    const posts = suivreCandidatures(page)
    await c.gotoSpontanee()
    await c.remplir(emailTest('autre'), { avecPoste: false })
    await c.poste.selectOption('autre')
    await expect(c.precision).toBeVisible()
    await c.envoyer.click()
    await expect(c.form.getByText('Précisez le poste recherché.')).toBeVisible()
    await expect(c.precision).toBeFocused()
    expect(posts).toHaveLength(0)

    await c.gotoOffre(offreUuid)
    await c.attendreHydratation()
    await expect(c.poste).toHaveCount(0)
  })

  test('should refuse a CV that is not a PDF and a CV over 5 Mo on the client, without any request', async ({ page }) => {
    const c = new CandidaturePage(page)
    const posts = suivreCandidatures(page)
    await c.gotoSpontanee()
    await c.remplir(emailTest('client-fichiers'), { avecPoste: true })

    await c.cv.setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]) })
    await c.envoyer.click()
    await expect(c.form.getByText('Le CV doit être un fichier PDF.')).toBeVisible()

    // Généré au moment du test dans le dossier de sortie (jamais versionné) : un `setInputFiles` en
    // mémoire de 11 Mo est très lent via CDP sur la machine d'exécution.
    const cheminGros = test.info().outputPath('gros-cv.pdf')
    ecrireFichierVolumineux(cheminGros, 11)
    await c.cv.setInputFiles(cheminGros)
    await c.envoyer.click()
    await expect(c.form.getByText('5 Mo au maximum par fichier.')).toBeVisible()
    expect(posts).toHaveLength(0)
    await expect(c.nom).toHaveValue('Jean Tremblay')
  })

  // --- §6 critères 3 : envoi valide spontané (double clic = 1 seule requête) ---------------------
  test('should submit a spontaneous application, show the success toast, reset the form and persist a coherent Candidature with a PRIVE CV', async ({ page, request }) => {
    test.slow()
    const email = emailTest('spontanee')
    const c = new CandidaturePage(page)
    const posts = suivreCandidatures(page)
    await c.gotoSpontanee()
    await c.remplir(email, { avecPoste: true })
    await c.envoyer.click()

    await expect(page.getByText(CANDIDATURE_FORM.toastTitre).first()).toBeVisible()
    await expect(c.nom).toHaveValue('')
    await expect(c.email).toHaveValue('')
    await expect(page.getByText('cv-minimal.pdf')).toHaveCount(0)
    await expect(c.consentement).not.toBeChecked()
    expect(posts).toHaveLength(1)

    const lignes = inspecterCandidature(email)
    expect(lignes).toHaveLength(1)
    const ligne = lignes[0]!
    expect(ligne.consentementLe).toBeTruthy()
    expect(ligne.posteRecherche).toBe('manutention')
    expect(ligne.categorie).toBe('MANUTENTION')
    expect(ligne.demande).toBeNull()
    expect(ligne.cv.visibilite).toBe('PRIVE')
    expect(ligne.cv.mimeType).toBe('application/pdf')
    expect(ligne.cv.company?.slug).toBe('placement')
    expect(ligne.cv.nomOriginal).toBe('cv-minimal.pdf')

    // §6 critère 6 (partie sans session) : un fichier PRIVE n'est jamais public.
    const lecture = await request.get(`/api/files/${ligne.cvKey}`)
    expect(lecture.status()).toBe(HTTP.unauthorized)
  })

  test('should send a single request and create a single Candidature when the submit button is double-clicked', async ({ page }) => {
    test.slow()
    const email = emailTest('dblclick')
    const c = new CandidaturePage(page)
    const posts = suivreCandidatures(page)
    await c.gotoSpontanee()
    await c.remplir(email, { avecPoste: true })
    await c.envoyer.dblclick()
    await expect(page.getByText(CANDIDATURE_FORM.toastTitre).first()).toBeVisible()
    await expect(c.nom).toHaveValue('')
    expect(inspecterCandidature(email), 'une seule candidature créée').toHaveLength(1)
    expect(posts, 'double clic = une seule requête HTTP').toHaveLength(1)
  })

  test('should apply on an offer: no position field, 201, toast, reset, and the Candidature is linked to the offer title', async ({ page }) => {
    test.slow()
    const email = emailTest('offre')
    const c = new CandidaturePage(page)
    await c.gotoOffre(offreUuid)
    await c.remplir(email, { avecPoste: false })
    await c.envoyer.click()
    await expect(page.getByText(CANDIDATURE_FORM.toastTitre).first()).toBeVisible()
    await expect(c.nom).toHaveValue('')

    const lignes = inspecterCandidature(email)
    expect(lignes).toHaveLength(1)
    expect(lignes[0]!.demande?.uuid).toBe(offreUuid)
    expect(lignes[0]!.posteRecherche).toBe(TITRE_OFFRE)
    expect(lignes[0]!.categorie).toBe('MANUTENTION')
  })

  // --- §6 critère 4 : fichiers refusés ------------------------------------------------------------
  test('should refuse a fake PDF (text renamed .pdf) with a « Fichier refusé » toast, keep the entered values and store nothing', async ({ page }) => {
    test.slow()
    const avant = compterFichiersPlacement()
    const email = emailTest('faux-pdf')
    const c = new CandidaturePage(page)
    const posts = suivreCandidatures(page)
    await c.gotoSpontanee()
    // Le navigateur déduit `application/pdf` de l'extension : le contrôle client passe, le serveur
    // (magic bytes) doit refuser en 415.
    await c.remplir(email, { avecPoste: true, cvPath: FAUX_PDF_PATH })

    const reponse = page.waitForResponse((r) => r.url().includes('/api/public/placement/candidatures'))
    await c.envoyer.click()
    expect((await reponse).status()).toBe(HTTP.unsupported)
    await expect(page.getByText(TOAST_FICHIER_REFUSE, { exact: false }).first()).toBeVisible()
    await expect(c.nom).toHaveValue('Jean Tremblay')
    await expect(c.email).toHaveValue(email)
    await expect(page.getByText('faux-cv.pdf')).toBeVisible()
    await expect(c.cv).toHaveAttribute('aria-invalid', 'true') // erreur portée par le champ CV
    expect(posts).toHaveLength(1)

    expect(compterFichiersPlacement(), 'aucun Fichier orphelin après un 415').toBe(avant)
  })

  test('should answer 415 on a fake PDF and 413 on an 11 Mo upload at the API, leaving no Fichier behind', async ({ request }) => {
    test.slow()
    const avant = compterFichiersPlacement()
    const faux = await postCandidature(request, nextTestIp(), champsApi(emailTest('api-faux')), {
      cv: { name: 'faux.pdf', mimeType: 'application/pdf', buffer: fauxPdfBuffer() },
    })
    expect(faux.status()).toBe(HTTP.unsupported)

    const gros = pdfVolumineux(11)
    const trop = await postCandidature(request, nextTestIp(), champsApi(emailTest('api-gros')), { cv: gros })
    expect(trop.status()).toBe(HTTP.tooLarge)

    expect(compterFichiersPlacement(), 'aucun Fichier orphelin après 415 / 413').toBe(avant)
  })

  test('should show the « Fichier refusé » toast and keep the values when the server answers 413 (response simulated: the client already blocks > 5 Mo files)', async ({ page }) => {
    const c = new CandidaturePage(page)
    await c.gotoSpontanee()
    await page.route('**/api/public/placement/candidatures', (route) => route.fulfill({ status: HTTP.tooLarge, json: { statusMessage: 'Requête trop volumineuse' } }))
    await c.remplir(emailTest('mock-413'), { avecPoste: true })
    await c.envoyer.click()
    await expect(page.getByText(TOAST_FICHIER_REFUSE, { exact: false }).first()).toBeVisible()
    await expect(c.nom).toHaveValue('Jean Tremblay')
    await expect(c.cv).toBeVisible()
    await expect(page.getByText('cv-minimal.pdf')).toBeVisible()
  })

  // --- §6 critère 2/5 : offre retirée, honeypot, rate limit, gardes ----------------------------
  test('should answer 404 on the detail (API and page) and on a POST once the offer is withdrawn, and 404 on a POST for an unknown offer', async ({ request, page }) => {
    test.slow()
    const avant = await request.get(`/api/public/placement/offres/${offreRetireeUuid}`)
    expect(avant.status()).toBe(HTTP.ok)

    retirerOffreTest(offreRetireeUuid)

    expect((await request.get(`/api/public/placement/offres/${offreRetireeUuid}`)).status()).toBe(HTTP.notFound)
    const liste = (await (await request.get('/api/public/placement/offres')).json()) as { uuid: string }[]
    expect(liste.some((o) => o.uuid === offreRetireeUuid)).toBe(false)
    const res = await page.goto(`/placement/offres/${offreRetireeUuid}`)
    expect(res?.status()).toBe(HTTP.notFound)

    const post = await postCandidature(request, nextTestIp(), champsApi(emailTest('retiree'), { demandeUuid: offreRetireeUuid, posteRecherche: '' }))
    expect(post.status()).toBe(HTTP.notFound)
    const inconnue = await postCandidature(request, nextTestIp(), champsApi(emailTest('inconnue'), { demandeUuid: UUID_INCONNU, posteRecherche: '' }))
    expect(inconnue.status()).toBe(HTTP.notFound)
  })

  test('should answer 201 without writing anything on a filled honeypot, then 429 with Retry-After on the 4th request from the same IP', async ({ request }) => {
    test.slow()
    const ip = nextTestIp()
    const email = emailTest('honeypot')
    for (let i = 0; i < 3; i += 1) {
      const res = await postCandidature(request, ip, champsApi(email, { website: 'bot' }))
      expect(res.status(), `requête ${i + 1}`).toBe(HTTP.created)
    }
    const quatrieme = await postCandidature(request, ip, champsApi(email, { website: 'bot' }))
    expect(quatrieme.status()).toBe(HTTP.tooMany)
    expect(Number(quatrieme.headers()['retry-after'])).toBeGreaterThan(0)
    expect(inspecterCandidature(email), 'le honeypot n’écrit aucune ligne').toHaveLength(0)
  })

  test('should refuse non-multipart bodies (415), a missing consent or CV (400) and unknown extra fields (400)', async ({ request }) => {
    const json = await request.post('/api/public/placement/candidatures', {
      headers: { 'x-forwarded-for': nextTestIp() },
      data: champsApi(emailTest('json')),
    })
    expect(json.status()).toBe(HTTP.unsupported)

    const sansConsentement = await postCandidature(request, nextTestIp(), champsApi(emailTest('sans-consent'), { consentement: 'false' }))
    expect(sansConsentement.status()).toBe(HTTP.badRequest)
    const sansCv = await postCandidature(request, nextTestIp(), champsApi(emailTest('sans-cv')), {})
    expect(sansCv.status()).toBe(HTTP.badRequest)
    const champExtra = await postCandidature(request, nextTestIp(), champsApi(emailTest('extra'), { statut: 'ACCEPTEE' }))
    expect(champExtra.status()).toBe(HTTP.badRequest)
  })

  test('should offer every position of POSTES_CANDIDAT in the spontaneous form select', async ({ page }) => {
    const c = new CandidaturePage(page)
    await c.gotoSpontanee()
    for (const poste of POSTES_CANDIDAT) {
      await expect(c.poste.getByRole('option', { name: poste.label, exact: true })).toHaveCount(1)
    }
  })

  // --- §6 critère 11 : 375 px ---------------------------------------------------------------------
  test.describe('375 px', () => {
    test.use({ viewport: VIEWPORT_MOBILE })

    test('should not scroll horizontally on the list, the detail and the spontaneous page, with a submit button >= 44 px', async ({ page }) => {
      for (const chemin of ['/placement/offres', `/placement/offres/${offreUuid}`, '/placement/offres/candidature-spontanee']) {
        await page.goto(chemin)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
        expect(scrollWidth, chemin).toBeLessThanOrEqual(VIEWPORT_MOBILE.width)
      }
      const c = new CandidaturePage(page)
      await c.gotoSpontanee()
      await c.attendreHydratation()
      const box = await c.envoyer.boundingBox()
      expect(box!.height).toBeGreaterThanOrEqual(MIN_TARGET_PX)
      for (const champ of [c.nom, c.email, c.telephone, c.pays, c.adresse, c.poste, c.experience]) {
        expect((await champ.boundingBox())!.height, 'contrôle >= 44 px').toBeGreaterThanOrEqual(MIN_TARGET_PX)
      }
      await c.cv.setInputFiles(CV_PDF_PATH)
      const retirer = page.getByRole('button', { name: 'Retirer cv-minimal.pdf' })
      expect((await retirer.boundingBox())!.width).toBeGreaterThanOrEqual(MIN_TARGET_PX)
      expect((await retirer.boundingBox())!.height).toBeGreaterThanOrEqual(MIN_TARGET_PX)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(VIEWPORT_MOBILE.width)
    })
  })
})
