// /admin/ccdpaa/reservations — liste + changement de statut, contrainte unique partielle
// (spec docs/specs/lot5-reservations.md §6, critères §9). Exécuté contre le BUILD DE
// PRODUCTION (même outillage que admin-placement.spec.ts : loginAs, marqueurs, apiAs).
//
// Isolation : marqueur dédié `r…` (27 ReservationRestaurant seedées, courriels
// `resa-<i>-<marqueur>@example.test` : 23 isolées ccdpaa + un couple même courriel + même
// créneau pour le 409 + une ANNULEE isolée pour la réactivation légale + une ligne entretien
// pour le 404 hors module) + courriels publics collectés et purgés via --reservation-email.
// Les 3 lignes démo réelles (Fatou/Marc-André/Alliance) s'ajoutent au total : toutes les
// assertions de volume sont relatives (`some()`, page pleine), jamais des totaux absolus.
import { test, expect, request as pwRequest, type APIRequestContext, type TestInfo } from '@playwright/test'
import type { AdminDashboardDto, AdminPage, AdminReservationDto } from '#shared/types/admin'
import type { PublicRestaurantDto } from '#shared/types/public'
import { ajouterJoursIso, dateDuJourQuebec } from '#shared/utils/dates'
import { bornesDates, creneauxPourDate, type ReglagesReservation } from '#shared/utils/restaurant'
import {
  ADMIN_FILIALE_CCDPAA,
  ADMIN_FILIALE_ENTRETIEN,
  EMPLOYE_ENTRETIEN,
  SUPER_ADMIN,
  loginAs,
} from './helpers/auth'
import { compterReservations, inspecterReservations, nettoyer, purgerReservations, semerReservations } from './helpers/db'
import { nextTestIp } from './helpers/ip'
import { emailTest, nouveauMarqueur } from './fixtures/admin-data'
import { AdminShell, apiAs, clesInterdites } from './fixtures/admin-pages'

const HTTP = { OK: 200, CREATED: 201, BAD_REQUEST: 400, UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409 } as const
const UUID_INCONNU = '00000000-0000-0000-0000-000000000000'
const TOAST_STATUT = 'Réservation mise à jour.'
const ERREUR_CONFLIT = 'Une réservation active existe déjà pour ce créneau et ce courriel.'
const DECALAGE_JOURS_TEST = 7

let marqueur = ''
const courrielsPublics: string[] = []

function baseURL(testInfo: TestInfo): string {
  return (testInfo.project.use.baseURL as string | undefined) || 'http://localhost:3200'
}

/** Première date ouverte à partir de J+7 (mêmes fonctions pures que le client et le serveur). */
function dateOuverte(r: ReglagesReservation, aPartirDe: string): string {
  const { max } = bornesDates(r)
  for (let d = aPartirDe; d <= max; d = ajouterJoursIso(d, 1)) {
    if (creneauxPourDate(r, d, new Date()).length > 0) return d
  }
  throw new Error('Aucune date ouverte dans l’horizon de réservation')
}

async function chargerReglages(request: APIRequestContext): Promise<PublicRestaurantDto> {
  const res = await request.get('/api/public/restaurant')
  expect(res.status()).toBe(HTTP.OK)
  return (await res.json()) as PublicRestaurantDto
}

function corpsReservation(email: string, r: ReglagesReservation): Record<string, unknown> {
  const date = dateOuverte(r, ajouterJoursIso(dateDuJourQuebec(), DECALAGE_JOURS_TEST))
  return {
    nom: 'Jean Tremblay',
    email,
    telephone: '514-555-0123',
    date,
    heure: creneauxPourDate(r, date, new Date())[0],
    nombrePersonnes: 2,
  }
}

function courrielPublic(label: string): string {
  const email = emailTest(label, marqueur)
  courrielsPublics.push(email)
  return email
}

test.beforeAll(() => {
  marqueur = nouveauMarqueur('r')
  semerReservations(marqueur)
})

test.afterAll(() => {
  nettoyer({ reservationEmails: courrielsPublics })
  purgerReservations(marqueur)
  expect(compterReservations(`-${marqueur}@example.test`)).toBe(0)
})

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
test.describe('API /api/admin/reservations', () => {
  test('401 sans session ; 403 AF/EMPLOYE d’une autre filiale ; liste seedée sans fuite d’internes', async ({}, testInfo) => {
    const anon = await pwRequest.newContext({ baseURL: baseURL(testInfo) })
    try {
      expect((await anon.get('/api/admin/reservations')).status(), 'GET sans session').toBe(HTTP.UNAUTHORIZED)
      expect((await anon.patch(`/api/admin/reservations/${UUID_INCONNU}`, { data: { statut: 'CONFIRMEE' } })).status(), 'PATCH sans session').toBe(
        HTTP.UNAUTHORIZED,
      )
    } finally {
      await anon.dispose()
    }

    const af = await apiAs(testInfo, ADMIN_FILIALE_ENTRETIEN)
    const employe = await apiAs(testInfo, EMPLOYE_ENTRETIEN)
    const sa = await apiAs(testInfo, SUPER_ADMIN)
    const afCcdpaa = await apiAs(testInfo, ADMIN_FILIALE_CCDPAA)
    try {
      expect((await af.get('/api/admin/reservations')).status(), 'AF entretien GET').toBe(HTTP.FORBIDDEN)
      expect((await af.patch(`/api/admin/reservations/${UUID_INCONNU}`, { data: { statut: 'CONFIRMEE' } })).status(), 'AF entretien PATCH').toBe(
        HTTP.FORBIDDEN,
      )
      expect((await employe.get('/api/admin/reservations')).status(), 'EMPLOYE GET').toBe(HTTP.FORBIDDEN)
      expect((await employe.patch(`/api/admin/reservations/${UUID_INCONNU}`, { data: { statut: 'CONFIRMEE' } })).status(), 'EMPLOYE PATCH').toBe(
        HTTP.FORBIDDEN,
      )

      const liste = await sa.get('/api/admin/reservations')
      expect(liste.status()).toBe(HTTP.OK)
      expect(liste.headers()['cache-control']).toContain('no-store')
      const page = (await liste.json()) as AdminPage<AdminReservationDto>
      expect(page.total).toBeGreaterThanOrEqual(25)
      expect(page.items).toHaveLength(20)
      expect(page.items.some((r) => r.email.endsWith(`-${marqueur}@example.test`))).toBe(true)
      expect(page.items.every((r) => r.site.slug === 'ccdpaa')).toBe(true)
      expect(clesInterdites(page)).toEqual([])

      const listeCcdpaa = (await (await afCcdpaa.get('/api/admin/reservations')).json()) as AdminPage<AdminReservationDto>
      expect(listeCcdpaa.total).toBeGreaterThanOrEqual(25)
      expect(listeCcdpaa.items.some((r) => r.email.endsWith(`-${marqueur}@example.test`))).toBe(true)
      expect(clesInterdites(listeCcdpaa)).toEqual([])
    } finally {
      await af.dispose()
      await employe.dispose()
      await sa.dispose()
      await afCcdpaa.dispose()
    }
  })

  test('400 sur query/body/params invalides, jamais 500', async ({}, testInfo) => {
    const sa = await apiAs(testInfo, SUPER_ADMIN)
    try {
      expect((await sa.get('/api/admin/reservations?statut=INVALIDE')).status()).toBe(HTTP.BAD_REQUEST)
      expect((await sa.get('/api/admin/reservations?page=0')).status()).toBe(HTTP.BAD_REQUEST)

      const cible = (await (
        await sa.get(`/api/admin/reservations?q=${encodeURIComponent(emailTest('resa-00', marqueur))}`)
      ).json()) as AdminPage<AdminReservationDto>
      const uuid = cible.items[0]!.uuid

      expect((await sa.patch(`/api/admin/reservations/abc`, { data: { statut: 'CONFIRMEE' } })).status(), 'uuid malformé').toBe(HTTP.BAD_REQUEST)
      expect((await sa.patch(`/api/admin/reservations/${uuid}`, { data: { statut: 'X' } })).status()).toBe(HTTP.BAD_REQUEST)
      expect((await sa.patch(`/api/admin/reservations/${uuid}`, { data: { statut: 'CONFIRMEE', note: 'a' } })).status(), 'champ inconnu (strict)').toBe(
        HTTP.BAD_REQUEST,
      )
    } finally {
      await sa.dispose()
    }
  })

  test('recherche, filtre statut et pagination sur les 25 seedées', async ({}, testInfo) => {
    const sa = await apiAs(testInfo, SUPER_ADMIN)
    try {
      const q = (await (
        await sa.get(`/api/admin/reservations?q=${encodeURIComponent(emailTest('resa-07', marqueur))}`)
      ).json()) as AdminPage<AdminReservationDto>
      expect(q.items.some((r) => r.email === emailTest('resa-07', marqueur))).toBe(true)

      const attente = (await (await sa.get('/api/admin/reservations?statut=EN_ATTENTE')).json()) as AdminPage<AdminReservationDto>
      expect(attente.items.length).toBeGreaterThan(0)
      expect(attente.items.every((r) => r.statut === 'EN_ATTENTE')).toBe(true)
      expect(attente.items.some((r) => r.email === emailTest('resa-23', marqueur))).toBe(true)

      const page1 = (await (await sa.get('/api/admin/reservations')).json()) as AdminPage<AdminReservationDto>
      expect(page1.page).toBe(1)
      expect(page1.items).toHaveLength(20)
      const page2 = (await (await sa.get('/api/admin/reservations?page=2')).json()) as AdminPage<AdminReservationDto>
      expect(page2.page).toBe(2)
      expect(page2.total).toBe(page1.total)
      expect(page2.items.length).toBeGreaterThan(0)
      expect(page2.items.length).toBe(page1.total - 20)
      const uuids1 = new Set(page1.items.map((r) => r.uuid))
      expect(page2.items.every((r) => !uuids1.has(r.uuid))).toBe(true)
    } finally {
      await sa.dispose()
    }
  })

  test('PATCH 200 + DTO à jour (dateReservation ISO inchangée) ; 404 uuid inconnu', async ({}, testInfo) => {
    const sa = await apiAs(testInfo, SUPER_ADMIN)
    try {
      const avant = (await (
        await sa.get(`/api/admin/reservations?q=${encodeURIComponent(emailTest('resa-00', marqueur))}`)
      ).json()) as AdminPage<AdminReservationDto>
      const cible = avant.items.find((r) => r.email === emailTest('resa-00', marqueur))!
      expect(cible.statut).toBe('EN_ATTENTE')

      const maj = await sa.patch(`/api/admin/reservations/${cible.uuid}`, { data: { statut: 'CONFIRMEE' } })
      expect(maj.status()).toBe(HTTP.OK)
      const dto = (await maj.json()) as AdminReservationDto
      expect(dto.statut).toBe('CONFIRMEE')
      expect(dto.dateReservation).toBe(cible.dateReservation)
      expect(clesInterdites(dto)).toEqual([])

      const apres = (await (
        await sa.get(`/api/admin/reservations?q=${encodeURIComponent(emailTest('resa-00', marqueur))}`)
      ).json()) as AdminPage<AdminReservationDto>
      expect(apres.items.find((r) => r.uuid === cible.uuid)!.statut).toBe('CONFIRMEE')

      expect((await sa.patch(`/api/admin/reservations/${UUID_INCONNU}`, { data: { statut: 'CONFIRMEE' } })).status()).toBe(HTTP.NOT_FOUND)
    } finally {
      await sa.dispose()
    }
  })

  test('annulation → re-réservation du même créneau : 201 et 2 lignes (index partiel)', async ({ request }, testInfo) => {
    test.slow()
    const r = await chargerReglages(request)
    const email = courrielPublic('pub-annule')
    const corps = corpsReservation(email, r)

    const premier = await request.post('/api/public/restaurant/reservations', { headers: { 'x-forwarded-for': nextTestIp() }, data: corps })
    expect(premier.status()).toBe(HTTP.CREATED)
    expect(inspecterReservations(email)).toHaveLength(1)

    const sa = await apiAs(testInfo, SUPER_ADMIN)
    try {
      const trouve = (await (await sa.get(`/api/admin/reservations?q=${encodeURIComponent(email)}`)).json()) as AdminPage<AdminReservationDto>
      expect(trouve.items).toHaveLength(1)
      expect((await sa.patch(`/api/admin/reservations/${trouve.items[0]!.uuid}`, { data: { statut: 'ANNULEE' } })).status()).toBe(HTTP.OK)
    } finally {
      await sa.dispose()
    }

    const second = await request.post('/api/public/restaurant/reservations', { headers: { 'x-forwarded-for': nextTestIp() }, data: corps })
    expect(second.status(), 're-POST après annulation').toBe(HTTP.CREATED)
    expect(inspecterReservations(email)).toHaveLength(2)
  })

  test('P2002 admin : réactiver une ANNULEE en conflit → 409', async ({}, testInfo) => {
    const sa = await apiAs(testInfo, SUPER_ADMIN)
    try {
      const couple = (await (
        await sa.get(`/api/admin/reservations?q=${encodeURIComponent(emailTest('resa-23', marqueur))}`)
      ).json()) as AdminPage<AdminReservationDto>
      expect(couple.items).toHaveLength(2)
      const annulee = couple.items.find((r) => r.statut === 'ANNULEE')!
      const active = couple.items.find((r) => r.statut === 'EN_ATTENTE')!
      expect(annulee.dateReservation).toBe(active.dateReservation)

      const conflit = await sa.patch(`/api/admin/reservations/${annulee.uuid}`, { data: { statut: 'CONFIRMEE' } })
      expect(conflit.status()).toBe(HTTP.CONFLICT)

      const apres = (await (
        await sa.get(`/api/admin/reservations?q=${encodeURIComponent(emailTest('resa-23', marqueur))}`)
      ).json()) as AdminPage<AdminReservationDto>
      expect(apres.items.find((r) => r.uuid === annulee.uuid)!.statut).toBe('ANNULEE')
    } finally {
      await sa.dispose()
    }
  })

  test('réactivation ANNULEE→EN_ATTENTE isolée : 200 (l’index partiel l’autorise)', async ({}, testInfo) => {
    const sa = await apiAs(testInfo, SUPER_ADMIN)
    try {
      const solo = (await (
        await sa.get(`/api/admin/reservations?q=${encodeURIComponent(emailTest('resa-24', marqueur))}`)
      ).json()) as AdminPage<AdminReservationDto>
      expect(solo.items).toHaveLength(1)
      expect(solo.items[0]!.statut).toBe('ANNULEE')

      const maj = await sa.patch(`/api/admin/reservations/${solo.items[0]!.uuid}`, { data: { statut: 'EN_ATTENTE' } })
      expect(maj.status()).toBe(HTTP.OK)
      expect(((await maj.json()) as AdminReservationDto).statut).toBe('EN_ATTENTE')
    } finally {
      await sa.dispose()
    }
  })

  test('PATCH : 404 hors module (autre filiale), succès AF ccdpaa', async ({}, testInfo) => {
    const sa = await apiAs(testInfo, SUPER_ADMIN)
    const afCcdpaa = await apiAs(testInfo, ADMIN_FILIALE_CCDPAA)
    try {
      // La ligne entretien est invisible hors module (liste SA scopée ccdpaa).
      const invisible = (await (
        await sa.get(`/api/admin/reservations?q=${encodeURIComponent(emailTest('resa-autre', marqueur))}`)
      ).json()) as AdminPage<AdminReservationDto>
      expect(invisible.items).toHaveLength(0)

      const uuidAutre = inspecterReservations(emailTest('resa-autre', marqueur))[0]!.uuid
      expect((await sa.patch(`/api/admin/reservations/${uuidAutre}`, { data: { statut: 'CONFIRMEE' } })).status(), 'SA hors module').toBe(
        HTTP.NOT_FOUND,
      )
      expect((await afCcdpaa.patch(`/api/admin/reservations/${uuidAutre}`, { data: { statut: 'CONFIRMEE' } })).status(), 'AF ccdpaa hors module').toBe(
        HTTP.NOT_FOUND,
      )

      const avant = (await (
        await afCcdpaa.get(`/api/admin/reservations?q=${encodeURIComponent(emailTest('resa-09', marqueur))}`)
      ).json()) as AdminPage<AdminReservationDto>
      expect(avant.items).toHaveLength(1)
      expect(avant.items[0]!.statut).toBe('EN_ATTENTE')
      const maj = await afCcdpaa.patch(`/api/admin/reservations/${avant.items[0]!.uuid}`, { data: { statut: 'CONFIRMEE' } })
      expect(maj.status(), 'AF ccdpaa').toBe(HTTP.OK)
      expect(((await maj.json()) as AdminReservationDto).statut).toBe('CONFIRMEE')
    } finally {
      await sa.dispose()
      await afCcdpaa.dispose()
    }
  })

  test('idempotence publique : 2 POST identiques → 2×201 silencieux, 1 seule ligne', async ({ request }) => {
    test.slow()
    const r = await chargerReglages(request)
    const email = courrielPublic('pub-idem')
    const corps = corpsReservation(email, r)
    const ip = nextTestIp()

    expect((await request.post('/api/public/restaurant/reservations', { headers: { 'x-forwarded-for': ip }, data: corps })).status()).toBe(HTTP.CREATED)
    expect((await request.post('/api/public/restaurant/reservations', { headers: { 'x-forwarded-for': ip }, data: corps })).status(), 'renvoi identique').toBe(
      HTTP.CREATED,
    )
    expect(inspecterReservations(email)).toHaveLength(1)
  })

  test('dashboard : prochainesReservations scopées, à venir, triées, sans fuite', async ({}, testInfo) => {
    const sa = await apiAs(testInfo, SUPER_ADMIN)
    const afEntretien = await apiAs(testInfo, ADMIN_FILIALE_ENTRETIEN)
    try {
      const avant = new Date().toISOString()
      const dash = (await (await sa.get('/api/admin/dashboard')).json()) as AdminDashboardDto
      expect(dash.prochainesReservations.length).toBeGreaterThan(0)
      expect(dash.prochainesReservations.length).toBeLessThanOrEqual(5)
      const dates = dash.prochainesReservations.map((r) => r.dateReservation)
      expect([...dates].sort()).toEqual(dates)
      expect(
        dash.prochainesReservations.every((r) => r.site.slug === 'ccdpaa' && r.statut !== 'ANNULEE' && r.dateReservation >= avant),
        'ccdpaa, non annulées, à venir',
      ).toBe(true)
      expect(clesInterdites(dash.prochainesReservations)).toEqual([])

      const dashEntretien = (await (await afEntretien.get('/api/admin/dashboard')).json()) as AdminDashboardDto
      expect(dashEntretien.prochainesReservations).toEqual([])
    } finally {
      await sa.dispose()
      await afEntretien.dispose()
    }
  })
})

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------
test.describe('UI /admin/ccdpaa/reservations', () => {
  test.describe('SUPER_ADMIN', () => {
    test.beforeEach(async ({ context }) => {
      await loginAs(context, SUPER_ADMIN)
    })

    test('liste seedée, pagination 2 pages, page survit au rechargement', async ({ page }) => {
      await page.goto('/admin/ccdpaa/reservations')
      await expect(page.getByRole('heading', { name: 'Réservations' })).toBeVisible()
      await expect(page.getByText(emailTest('resa-22', marqueur), { exact: true })).toBeVisible()
      await expect(page.getByText('Page 1 / 2')).toBeVisible()

      const pagination = page.getByRole('navigation', { name: 'Pagination' })
      await pagination.getByRole('button', { name: 'Suivant' }).click()
      await expect(page).toHaveURL(/page=2/)
      await expect(page.getByText('Page 2 / 2')).toBeVisible()

      await page.reload()
      await expect(page).toHaveURL(/page=2/)
      await expect(page.getByText('Page 2 / 2')).toBeVisible()

      await pagination.getByRole('button', { name: 'Précédent' }).click()
      await expect(page).not.toHaveURL(/page=2/)
      await expect(page.getByText('Page 1 / 2')).toBeVisible()
    })

    test('recherche + filtre statut dans l’URL, conservés au rechargement, réinitialisables', async ({ page }) => {
      await page.goto('/admin/ccdpaa/reservations')
      await expect(page.getByRole('heading', { name: 'Réservations' })).toBeVisible()

      const filtres = page.getByRole('search', { name: 'Filtrer les réservations' })
      await filtres.getByLabel('Recherche').fill(emailTest('resa-07', marqueur))
      await expect(page).toHaveURL((url) => url.searchParams.get('q') === emailTest('resa-07', marqueur))
      await expect(page.getByText(emailTest('resa-07', marqueur), { exact: true })).toBeVisible()

      await page.reload()
      await expect(filtres.getByLabel('Recherche')).toHaveValue(emailTest('resa-07', marqueur))
      await expect(page.getByText(emailTest('resa-07', marqueur), { exact: true })).toBeVisible()

      await filtres.getByRole('combobox', { name: 'Statut' }).click()
      await page.getByRole('option', { name: 'En attente', exact: true }).click()
      await expect(page).toHaveURL(/statut=EN_ATTENTE/)
      await expect(page, 'changer un filtre revient à la page 1').not.toHaveURL(/page=2/)

      await page.reload()
      await expect(filtres.getByRole('combobox', { name: 'Statut' })).toHaveText('En attente')
      await expect(filtres.getByLabel('Recherche')).toHaveValue(emailTest('resa-07', marqueur))

      await filtres.getByRole('button', { name: 'Réinitialiser' }).click()
      await expect(page).not.toHaveURL(/statut=|q=/)
      await expect(page.getByText('Page 1 / 2')).toBeVisible()
    })

    test('change le statut d’une ligne : toast exact + badge à jour', async ({ page }) => {
      const email = emailTest('resa-03', marqueur)
      await page.goto(`/admin/ccdpaa/reservations?q=${encodeURIComponent(email)}`)
      const ligne = page.locator('tbody tr, ul li').filter({ hasText: email })
      await expect(ligne).toHaveCount(1)
      await expect(ligne.locator('[data-slot="badge"]')).toHaveText('En attente')

      await ligne.getByRole('combobox', { name: /Statut de la réservation/ }).click()
      await page.getByRole('option', { name: 'Confirmée', exact: true }).click()

      await expect(page.getByText(TOAST_STATUT, { exact: true })).toBeVisible()
      await expect(ligne.locator('[data-slot="badge"]')).toHaveText('Confirmée')
    })

    test('conflit 409 : toast d’erreur et badge inchangé', async ({ page }) => {
      const email = emailTest('resa-23', marqueur)
      await page.goto(`/admin/ccdpaa/reservations?q=${encodeURIComponent(email)}`)
      const ligne = page.locator('tbody tr, ul li').filter({ hasText: 'Client Resa Couple' })
      const annulee = ligne.filter({ hasText: 'Annulée' })
      await expect(annulee).toHaveCount(1)

      await annulee.getByRole('combobox', { name: /Statut de la réservation/ }).click()
      await page.getByRole('option', { name: 'Confirmée', exact: true }).click()

      await expect(page.getByText(ERREUR_CONFLIT, { exact: true })).toBeVisible()
      await expect(annulee.locator('[data-slot="badge"]')).toHaveText('Annulée')
    })

    test('pas de défilement horizontal', async ({ page }) => {
      await page.goto('/admin/ccdpaa/reservations')
      await expect(page.getByRole('heading', { name: 'Réservations' })).toBeVisible()
      const { sw, cw } = await page.evaluate(() => ({ sw: document.body.scrollWidth, cw: document.body.clientWidth }))
      expect(sw).toBeLessThanOrEqual(cw + 1)
    })
  })

  test.describe('ADMIN_FILIALE ccdpaa', () => {
    test.beforeEach(async ({ context }) => {
      await loginAs(context, ADMIN_FILIALE_CCDPAA)
    })

    test('voit la page et ses réservations', async ({ page }) => {
      const shell = new AdminShell(page)
      await page.goto('/admin/ccdpaa/reservations')
      await expect(page.getByRole('heading', { name: 'Réservations' })).toBeVisible()
      await expect(page.getByText(emailTest('resa-22', marqueur), { exact: true })).toBeVisible()
      await shell.ouvrirNavigation()
      await expect(shell.navigation.getByRole('link', { name: 'Réservations', exact: true })).toBeVisible()
    })
  })

  test.describe('ADMIN_FILIALE entretien (sans le module)', () => {
    test.beforeEach(async ({ context }) => {
      await loginAs(context, ADMIN_FILIALE_ENTRETIEN)
    })

    test('item de nav absent et accès direct → état erreur', async ({ page }) => {
      const shell = new AdminShell(page)
      await page.goto('/admin')
      await shell.ouvrirNavigation()
      await expect(shell.navigation.getByRole('link', { name: 'Réservations', exact: true })).toHaveCount(0)
      await shell.fermerNavigation()

      await page.goto('/admin/ccdpaa/reservations')
      await expect(page.getByRole('alert')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible()
    })
  })

  test.describe('dashboard /admin', () => {
    test('SA : section « Prochaines réservations » avec lien vers la page', async ({ page, context }) => {
      await loginAs(context, SUPER_ADMIN)
      await page.goto('/admin')
      await expect(page.getByRole('heading', { name: 'Prochaines réservations' })).toBeVisible()
      const lien = page.getByRole('link', { name: 'Voir toutes les réservations' })
      await expect(lien).toBeVisible()
      await expect(lien).toHaveAttribute('href', '/admin/ccdpaa/reservations')
      // Contenu : au moins une ligne seedée (nom · personnes), jamais une annulée.
      await expect(page.getByRole('link', { name: /Client Resa/ }).first()).toBeVisible()
    })

    test('AF entretien : section omise', async ({ page, context }) => {
      await loginAs(context, ADMIN_FILIALE_ENTRETIEN)
      await page.goto('/admin')
      await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Prochaines réservations' })).toHaveCount(0)
    })
  })
})
