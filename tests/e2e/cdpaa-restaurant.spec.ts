// /cdpaa/restaurant — page + réservation (spec docs/specs/lot3-pages-specifiques.md §3, §5 T3,
// §6 critères 1, 7, 8 (lecture), 11). Exécuté contre le BUILD DE PRODUCTION.
//
// Source de vérité des horaires : `GET /api/public/restaurant` (ReglagesRestaurant). Les créneaux
// attendus sont recalculés ici avec `creneauxPourDate` (shared/utils/restaurant.ts, même fonction
// pure que le client et le serveur), jamais recopiés en dur : le test reste vrai si les réglages
// changent en base. Aucune assertion sur le texte exact des sections éditables (RESTAURANT:hero,
// reservation) : seule leur présence (H1) est vérifiée. Libellés d'interface (boutons, toast,
// messages) sont du code et assertés.
//
// Isolation rate-limit : x-forwarded-for 203.0.113.x distinct par test (réservation 5/10 min/IP).
// Le critère 375 px est porté par un `test.use({ viewport })` local (projet « desktop » seulement).
import { test, expect, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { ajouterJoursIso, dateDuJourQuebec, jourIsoSemaine } from '#shared/utils/dates'
import {
  bornesDates,
  creneauxPourDate,
  libelleHeure,
  libelleJoursOuverture,
  type ReglagesReservation,
} from '#shared/utils/restaurant'
import type { PublicRestaurantDto } from '#shared/types/public'
import { nextTestIp } from './helpers/ip'
import { inspecterReservations, nettoyer } from './helpers/db'

const HTTP = { ok: 200, created: 201, badRequest: 400 } as const
const TOAST_RESERVATION = 'Réservation reçue'
const BOUTON_RESERVER = 'Réserver ma table'
const VIEWPORT_MOBILE = { width: 375, height: 812 } as const
const MIN_TARGET_PX = 44
const WCAG_AA_NORMAL = 4.5
const FUSEAU = 'America/Toronto'
const DECALAGE_JOURS_TEST = 7

const suffixe = Date.now()
const reservationEmails: string[] = []
function emailTest(label: string): string {
  const email = `e2e-lot3-resa-${label}-${suffixe}-${Math.random().toString(36).slice(2, 7)}@example.test`
  reservationEmails.push(email)
  return email
}

// --- Règles de date dérivées des réglages (mêmes fonctions pures que le client) ------------------
function dateOuverte(r: ReglagesReservation, aPartirDe: string): string {
  const { max } = bornesDates(r)
  for (let d = aPartirDe; d <= max; d = ajouterJoursIso(d, 1)) {
    if (creneauxPourDate(r, d, new Date()).length > 0) return d
  }
  throw new Error('Aucune date ouverte dans l’horizon de réservation')
}
function dateFermee(r: ReglagesReservation): string | null {
  const { min, max } = bornesDates(r)
  for (let d = ajouterJoursIso(min, 1); d <= max; d = ajouterJoursIso(d, 1)) {
    if (!r.joursOuverture.includes(jourIsoSemaine(d))) return d
  }
  return null
}
/** Décalage UTC (heures, ex. -4) de l'instant dans le fuseau Québec, via Intl (indépendant de instantQuebec). */
function decalageQuebec(instant: Date): number {
  const nom = new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU, timeZoneName: 'shortOffset' })
    .formatToParts(instant)
    .find((p) => p.type === 'timeZoneName')?.value ?? ''
  return Number(nom.replace('GMT', '') || '0')
}
function heureMurale(instant: Date): { date: string; heure: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(instant)
      .map((x) => [x.type, x.value]),
  )
  return { date: `${p.year}-${p.month}-${p.day}`, heure: `${p.hour}:${p.minute}` }
}

// --- Contraste WCAG ------------------------------------------------------------------------------
function luminance([r, g, b]: number[]): number {
  const c = [r, g, b].map((v) => {
    const s = (v ?? 0) / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!
}
function ratio(a: number[], b: number[]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}
const rgb = (css: string): number[] => (css.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)

// --- Page Object ---------------------------------------------------------------------------------
class RestaurantPage {
  constructor(private readonly page: Page) {}
  goto() {
    return this.page.goto('/cdpaa/restaurant')
  }
  get h1(): Locator { return this.page.getByRole('heading', { level: 1 }) }
  get form(): Locator {
    return this.page.locator('form').filter({ has: this.page.getByRole('button', { name: BOUTON_RESERVER }) })
  }
  get nom(): Locator { return this.form.getByLabel('Nom', { exact: true }) }
  get telephone(): Locator { return this.form.getByLabel('Téléphone', { exact: true }) }
  get email(): Locator { return this.form.getByLabel('Courriel', { exact: true }) }
  get date(): Locator { return this.form.getByLabel('Date', { exact: true }) }
  get heure(): Locator { return this.form.getByLabel('Heure', { exact: true }) }
  get personnes(): Locator { return this.form.getByLabel('Personnes', { exact: true }) }
  get notes(): Locator { return this.form.getByLabel('Notes (facultatif)', { exact: true }) }
  get reserver(): Locator { return this.form.getByRole('button', { name: BOUTON_RESERVER }) }

  async attendreHydratation() {
    await expect(this.reserver).toBeEnabled()
  }
  /** Libellés des créneaux réellement proposés (placeholder exclu). */
  async creneauxAffiches(): Promise<string[]> {
    const options = await this.heure.locator('option:not([disabled])').allTextContents()
    return options.map((o) => o.trim())
  }
}

function suivreReservations(page: Page): string[] {
  const urls: string[] = []
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('/api/public/restaurant/reservations')) urls.push(req.url())
  })
  return urls
}

async function chargerReglages(request: APIRequestContext): Promise<PublicRestaurantDto> {
  const res = await request.get('/api/public/restaurant')
  expect(res.status()).toBe(HTTP.ok)
  return (await res.json()) as PublicRestaurantDto
}

function corpsReservation(email: string, r: ReglagesReservation, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const date = dateOuverte(r, ajouterJoursIso(dateDuJourQuebec(), DECALAGE_JOURS_TEST))
  return {
    nom: 'Jean Tremblay',
    email,
    telephone: '514-555-0123',
    date,
    heure: creneauxPourDate(r, date, new Date())[0],
    nombrePersonnes: 2,
    ...extra,
  }
}

test.describe('cdpaa — restaurant et réservation', () => {
  test.afterAll(() => {
    test.setTimeout(240_000)
    nettoyer({ reservationEmails })
  })

  test.beforeEach(async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': nextTestIp() })
  })

  test('should answer 200, render the H1 and show opening days/hours read from the restaurant settings', async ({ page, request }) => {
    const res = await request.get('/cdpaa/restaurant')
    expect(res.status()).toBe(HTTP.ok)
    const r = await chargerReglages(request)
    const cles = Object.keys(r)
    for (const interdite of ['id', 'companyId', 'uuid']) expect(cles, interdite).not.toContain(interdite)

    const p = new RestaurantPage(page)
    await p.goto()
    await expect(p.h1).toBeVisible()
    await expect(page.getByText(libelleJoursOuverture(r.joursOuverture))).toBeVisible()
    await expect(page.getByText(`${libelleHeure(r.heureOuverture)} · ${libelleHeure(r.heureFermeture)}`)).toBeVisible()
    await expect(p.form).toBeVisible()
  })

  test('should not expose the nav « Restaurant » link as a 404', async ({ page }) => {
    await page.goto('/cdpaa')
    if ((page.viewportSize()?.width ?? 1440) < 768) await page.getByRole('button', { name: 'Menu' }).click()
    const lien = page.getByRole('link', { name: 'Restaurant', exact: true }).first()
    await expect(lien).toBeVisible()
    await lien.click()
    await expect(page).toHaveURL(/\/cdpaa\/restaurant$/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('should offer exactly the slots computed by creneauxPourDate for an open date and « Aucun créneau ce jour-là. » on a closed day', async ({ page, request }) => {
    const r = await chargerReglages(request)
    const p = new RestaurantPage(page)
    await p.goto()
    await p.attendreHydratation()
    await expect(p.heure).toBeDisabled() // aucune date choisie

    const ouverte = dateOuverte(r, ajouterJoursIso(dateDuJourQuebec(), DECALAGE_JOURS_TEST))
    await p.date.fill(ouverte)
    const attendus = creneauxPourDate(r, ouverte, new Date()).map(libelleHeure)
    expect(attendus.length).toBeGreaterThan(0)
    await expect(p.heure).toBeEnabled()
    expect(await p.creneauxAffiches()).toEqual(attendus)
    await expect(p.form.getByText('Aucun créneau ce jour-là.')).toHaveCount(0)

    const options = await p.personnes.locator('option:not([disabled])').allTextContents()
    expect(options.map(Number)).toEqual(Array.from({ length: r.capaciteMaxReservation }, (_, i) => i + 1))

    const fermee = dateFermee(r)
    test.skip(fermee === null, 'Aucun jour fermé dans l’horizon (7 jours d’ouverture)')
    await p.date.fill(fermee!)
    await expect(p.form.getByText('Aucun créneau ce jour-là.')).toBeVisible()
    await expect(p.heure).toBeDisabled()
    expect(await p.creneauxAffiches()).toEqual([])
  })

  test('should reset the chosen slot when the date changes to a day that no longer offers it', async ({ page, request }) => {
    const r = await chargerReglages(request)
    const fermee = dateFermee(r)
    test.skip(fermee === null, 'Aucun jour fermé dans l’horizon')
    const p = new RestaurantPage(page)
    await p.goto()
    await p.attendreHydratation()
    await p.date.fill(dateOuverte(r, ajouterJoursIso(dateDuJourQuebec(), DECALAGE_JOURS_TEST)))
    const premier = creneauxPourDate(r, await p.date.inputValue(), new Date())[0]!
    await p.heure.selectOption(premier)
    await expect(p.heure).toHaveValue(premier)
    await p.date.fill(fermee!)
    await expect(p.heure).toHaveValue('')
  })

  test('should reject an empty submission client-side: errors, focus on the first invalid field and zero HTTP request', async ({ page }) => {
    const p = new RestaurantPage(page)
    const posts = suivreReservations(page)
    await p.goto()
    await p.attendreHydratation()
    await p.reserver.click()
    await expect(p.nom).toBeFocused()
    await expect(p.nom).toHaveAttribute('aria-invalid', 'true')
    await expect(p.telephone).toHaveAttribute('aria-invalid', 'true')
    await expect(p.email).toHaveAttribute('aria-invalid', 'true')
    await expect(p.date).toHaveAttribute('aria-invalid', 'true')
    await expect(p.personnes).toHaveAttribute('aria-invalid', 'true')
    expect(posts).toHaveLength(0)
  })

  test('should submit a valid reservation, toast, reset the form and store dateReservation at the right UTC instant', async ({ page, request }) => {
    test.slow()
    const r = await chargerReglages(request)
    const email = emailTest('ui')
    const date = dateOuverte(r, ajouterJoursIso(dateDuJourQuebec(), DECALAGE_JOURS_TEST))
    const heure = creneauxPourDate(r, date, new Date())[0]!
    const p = new RestaurantPage(page)
    const posts = suivreReservations(page)
    await p.goto()
    await p.attendreHydratation()
    await p.nom.fill('Jean Tremblay')
    await p.telephone.fill('514-555-0123')
    await p.email.fill(email)
    await p.date.fill(date)
    await p.heure.selectOption(heure)
    await p.personnes.selectOption('2')
    await p.notes.fill('Table près de la fenêtre (e2e).')
    await p.reserver.click()

    await expect(page.getByText(TOAST_RESERVATION).first()).toBeVisible()
    await expect(p.nom).toHaveValue('')
    await expect(p.email).toHaveValue('')
    await expect(p.date).toHaveValue('')
    expect(posts).toHaveLength(1)

    const lignes = inspecterReservations(email)
    expect(lignes).toHaveLength(1)
    const ligne = lignes[0]!
    expect(ligne.statut).toBe('EN_ATTENTE')
    expect(ligne.nombrePersonnes).toBe(2)
    const instant = new Date(ligne.dateReservation)
    expect(heureMurale(instant)).toEqual({ date, heure })
    expect(decalageQuebec(instant)).toBe(estHeureEte(date) ? -4 : -5)
  })

  test('should send a single request and create a single row when the submit button is double-clicked (idempotence)', async ({ page, request }) => {
    test.slow()
    const r = await chargerReglages(request)
    const email = emailTest('ui-dblclick')
    const date = dateOuverte(r, ajouterJoursIso(dateDuJourQuebec(), DECALAGE_JOURS_TEST))
    const heure = creneauxPourDate(r, date, new Date())[0]!
    const p = new RestaurantPage(page)
    const posts = suivreReservations(page)
    await p.goto()
    await p.attendreHydratation()
    await p.nom.fill('Jean Tremblay')
    await p.telephone.fill('514-555-0123')
    await p.email.fill(email)
    await p.date.fill(date)
    await p.heure.selectOption(heure)
    await p.personnes.selectOption('2')
    await p.reserver.dblclick()
    await expect(page.getByText(TOAST_RESERVATION).first()).toBeVisible()
    await expect(p.nom).toHaveValue('')
    // Filet côté serveur (doublon même courriel + même instant → 201 sans écriture) : une seule ligne.
    expect(inspecterReservations(email)).toHaveLength(1)
    expect(posts, 'double clic = une seule requête HTTP').toHaveLength(1)
  })

  test('should store the right UTC instant in winter time too, and stay idempotent on an identical second submission (one row only)', async ({ request }) => {
    test.slow()
    const r = await chargerReglages(request)
    // Date d'hiver (EST, UTC-5) si l'horizon en contient une ; sinon repli sur une date d'été (le
    // calcul UTC reste vérifié contre Intl).
    const { min, max } = bornesDates(r)
    let date = dateOuverte(r, ajouterJoursIso(dateDuJourQuebec(), DECALAGE_JOURS_TEST))
    for (let d = max; d > min; d = ajouterJoursIso(d, -1)) {
      if (!estHeureEte(d) && creneauxPourDate(r, d, new Date()).length > 0) {
        date = d
        break
      }
    }
    const email = emailTest('api-idem')
    const corps = corpsReservation(email, r, { date, heure: creneauxPourDate(r, date, new Date()).at(-1) })
    const ip = nextTestIp()

    const premier = await request.post('/api/public/restaurant/reservations', { headers: { 'x-forwarded-for': ip }, data: corps })
    expect(premier.status()).toBe(HTTP.created)
    const second = await request.post('/api/public/restaurant/reservations', { headers: { 'x-forwarded-for': ip }, data: corps })
    expect(second.status(), 'renvoi identique = 201 sans écriture').toBe(HTTP.created)

    const lignes = inspecterReservations(email)
    expect(lignes).toHaveLength(1)
    const instant = new Date(lignes[0]!.dateReservation)
    expect(heureMurale(instant)).toEqual({ date, heure: corps.heure })
    expect(decalageQuebec(instant)).toBe(estHeureEte(date) ? -4 : -5)
  })

  test('should answer 400 on a closed day, a past date, a slot outside the offered ones and too many people', async ({ request }) => {
    const r = await chargerReglages(request)
    const email = emailTest('api-400')
    const post = async (extra: Record<string, unknown>) =>
      request.post('/api/public/restaurant/reservations', {
        headers: { 'x-forwarded-for': nextTestIp() },
        data: corpsReservation(email, r, extra),
      })

    const fermee = dateFermee(r)
    if (fermee) expect((await post({ date: fermee, heure: r.heureOuverture })).status(), 'jour fermé').toBe(HTTP.badRequest)
    expect((await post({ date: ajouterJoursIso(dateDuJourQuebec(), -1) })).status(), 'date passée').toBe(HTTP.badRequest)
    expect((await post({ heure: '03:00' })).status(), 'heure hors créneau').toBe(HTTP.badRequest)
    expect((await post({ nombrePersonnes: r.capaciteMaxReservation + 1 })).status(), 'trop de personnes').toBe(HTTP.badRequest)
    expect((await post({ nombrePersonnes: 0 })).status(), '0 personne').toBe(HTTP.badRequest)
    expect((await post({ date: ajouterJoursIso(bornesDates(r).max, 1) })).status(), 'au-delà de l’horizon').toBe(HTTP.badRequest)
    expect((await post({ statut: 'CONFIRMEE' })).status(), 'champ inconnu').toBe(HTTP.badRequest)
    expect(inspecterReservations(email), 'aucune ligne créée').toHaveLength(0)
  })

  test.describe('375 px', () => {
    test.use({ viewport: VIEWPORT_MOBILE })

    test('should not scroll horizontally, keep controls >= 44 px and a WCAG AA contrast on the reservation card', async ({ page }) => {
      const p = new RestaurantPage(page)
      await p.goto()
      await p.attendreHydratation()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(VIEWPORT_MOBILE.width)

      for (const champ of [p.nom, p.telephone, p.email, p.date, p.heure, p.personnes]) {
        expect((await champ.boundingBox())!.height, 'contrôle >= 44 px').toBeGreaterThanOrEqual(MIN_TARGET_PX)
      }
      expect((await p.reserver.boundingBox())!.height).toBeGreaterThanOrEqual(MIN_TARGET_PX)

      // Contraste : titre de la carte et bouton d'envoi (texte accent sur blanc).
      const couleurs = await page.evaluate(() => {
        const form = document.querySelector('form') as HTMLElement
        const cible = Array.from(document.querySelectorAll('form')).find((f) => f.querySelector('button[type="submit"]')?.textContent?.includes('Réserver ma table')) ?? form
        const titre = cible.querySelector('h2') as HTMLElement
        const bouton = cible.querySelector('button[type="submit"]') as HTMLElement
        return {
          fond: getComputedStyle(cible).backgroundColor,
          titre: getComputedStyle(titre).color,
          boutonFond: getComputedStyle(bouton).backgroundColor,
          boutonTexte: getComputedStyle(bouton).color,
        }
      })
      expect(ratio(rgb(couleurs.titre), rgb(couleurs.fond)), 'titre sur carte').toBeGreaterThanOrEqual(WCAG_AA_NORMAL)
      expect(ratio(rgb(couleurs.boutonTexte), rgb(couleurs.boutonFond)), 'bouton').toBeGreaterThanOrEqual(WCAG_AA_NORMAL)
    })
  })
})

/** Heure d'été (EDT, UTC-4) : du 2e dimanche de mars (inclus) au 1er dimanche de novembre (exclu). */
function estHeureEte(dateIso: string): boolean {
  const annee = Number(dateIso.slice(0, 4))
  const dimanche = (mois: number, n: number): string => {
    const premier = `${annee}-${String(mois).padStart(2, '0')}-01`
    const decalage = (7 - jourIsoSemaine(premier)) % 7
    return ajouterJoursIso(premier, decalage + (n - 1) * 7)
  }
  return dateIso >= dimanche(3, 2) && dateIso < dimanche(11, 1)
}
