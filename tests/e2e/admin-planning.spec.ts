// /admin/{entretien,transport,ccdpaa}/planning + /admin/mon-planning — grille semaine, CRUD quarts,
// lecture employé (spec docs/specs/lot5-planning.md §4, critères §7). Exécuté contre le BUILD DE
// PRODUCTION (même outillage que admin-reservations.spec.ts : loginAs, marqueurs, apiAs, clesInterdites).
//
// Isolation : marqueur dédié `p…` — 3 employés de test TRANSPORT (seule filiale sans comptes
// AF/employé seedés dédiés : aucune collision) `planning-<i>-<marqueur>@example.test`
// (Employe.email nullable = clé de purge), dont 1 actif=false, + 3 quarts datés relatifs à la
// semaine courante (dont une NUIT 22:00→06:00 lendemain). Les quarts posés par les tests via l'API
// sur le dossier seedé d'Awa Diallo (entretien, non marqué) portent un titre `[E2E <marqueur>]…`,
// supprimés par DELETE en fin de test ET purgés par --purge-planning (filet de sécurité).
// Aucune assertion de volume absolue sur les employés : le seed démo en contient d'autres,
// les assertions sont relatives (`some()`, `find()`), jamais des totaux.
//
// Écarts à la spec §4 assumés et documentés :
// - ADMIN_FILIALE_TRANSPORT n'existe pas dans prisma/seed/accounts.ts (et prisma/** est hors
//   périmètre T3) : le 403 inter-filiale est testé avec l'AF entretien ET l'AF ccdpaa SUR
//   /api/admin/planning/transport (requireModule scoping company, équivalent).
// - Employé sans dossier (404 mon-planning) : aucun compte EMPLOYE non lié n'existe au seed
//   (accounts.ts n'en crée qu'un, lié par demo.ts) et en créer un demanderait prisma/seed —
//   test non couvert, à ajouter à la création d'un tel compte.
import { test, expect, request as pwRequest, type TestInfo } from '@playwright/test'
import type { AdminQuartDto, MonPlanningDto, PlanningSemaineDto } from '#shared/types/admin'
import { ajouterJoursIso, formatDateLongue, instantQuebec } from '#shared/utils/dates'
import { lundiDeSemaineQuebec, totalHeures } from '#shared/utils/planning'
import {
  ADMIN_FILIALE_CCDPAA,
  ADMIN_FILIALE_ENTRETIEN,
  EMPLOYE_ENTRETIEN,
  SUPER_ADMIN,
  loginAs,
} from './helpers/auth'
import { compterPlanning, purgerPlanning, semerPlanning } from './helpers/db'
import { nouveauMarqueur } from './fixtures/admin-data'
import { AdminShell, apiAs, clesInterdites, estMobile } from './fixtures/admin-pages'

const HTTP = { OK: 200, CREATED: 201, NO_CONTENT: 204, BAD_REQUEST: 400, UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404 } as const
const UUID_INCONNU = '00000000-0000-0000-0000-000000000000'
const TOAST_AJOUT = 'Quart ajouté.'
const TOAST_MAJ = 'Quart mis à jour.'
const TOAST_SUPPRESSION = 'Quart supprimé.'
const URL_TRANSPORT = '/api/admin/planning/transport'
const URL_ENTRETIEN = '/api/admin/planning/entretien'
const SEMAINE = lundiDeSemaineQuebec()

let marqueur = ''
let quartApiUuid = ''
let quartAutreUuid = ''
let quartCroiseUuid = ''
let quartNuitUuid = ''

function baseURL(testInfo: TestInfo): string {
  return (testInfo.project.use.baseURL as string | undefined) || 'http://localhost:3200'
}

/** Noms des 3 employés seedés (miroir de semerPlanning dans cleanup-test-data.ts). */
function nomEmployeSeed(index: 0 | 1 | 2): string {
  return `Planning E2E ${['Un', 'Deux', 'Inactif'][index]!} ${marqueur}`
}

function corpsQuart(
  employeUuid: string,
  dateDebut: Date,
  dateFin: Date,
  lieu: string,
  titre?: string,
): Record<string, unknown> {
  return {
    employeUuid,
    dateDebut: dateDebut.toISOString(),
    dateFin: dateFin.toISOString(),
    lieu,
    ...(titre ? { titre } : {}),
  }
}

test.beforeAll(() => {
  marqueur = nouveauMarqueur('p')
  semerPlanning(marqueur)
})

test.afterAll(() => {
  purgerPlanning(marqueur)
  const reste = compterPlanning(marqueur)
  expect(reste.employes, 'aucun employé résiduel').toBe(0)
  expect(reste.quarts, 'aucun quart résiduel').toBe(0)
})

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
test.describe('API /api/admin/planning', () => {
  test('401 sans session sur GET/POST/PATCH/DELETE et mon-planning', async ({}, testInfo) => {
    const anon = await pwRequest.newContext({ baseURL: baseURL(testInfo) })
    try {
      expect((await anon.get(URL_TRANSPORT)).status(), 'GET sans session').toBe(HTTP.UNAUTHORIZED)
      expect((await anon.post(URL_TRANSPORT, { data: {} })).status(), 'POST sans session').toBe(HTTP.UNAUTHORIZED)
      expect(
        (await anon.patch(`${URL_TRANSPORT}/${UUID_INCONNU}`, { data: { lieu: 'Bureau' } })).status(),
        'PATCH sans session',
      ).toBe(HTTP.UNAUTHORIZED)
      expect((await anon.delete(`${URL_TRANSPORT}/${UUID_INCONNU}`)).status(), 'DELETE sans session').toBe(HTTP.UNAUTHORIZED)
      expect((await anon.get('/api/admin/mon-planning')).status(), 'mon-planning sans session').toBe(HTTP.UNAUTHORIZED)
    } finally {
      await anon.dispose()
    }
  })

  test('403 AF/EMPLOYE hors site planning ; 403 SA/AF sur mon-planning', async ({}, testInfo) => {
    const afEntretien = await apiAs(testInfo, ADMIN_FILIALE_ENTRETIEN)
    const afCcdpaa = await apiAs(testInfo, ADMIN_FILIALE_CCDPAA)
    const employe = await apiAs(testInfo, EMPLOYE_ENTRETIEN)
    const sa = await apiAs(testInfo, SUPER_ADMIN)
    try {
      // AF entretien : le module PLANNING est actif sur sa filiale, mais transport est hors scope
      // (requireModule scoping company) → 403 inter-filiale.
      expect((await afEntretien.get(URL_TRANSPORT)).status(), 'AF entretien GET transport').toBe(HTTP.FORBIDDEN)
      expect((await afEntretien.post(URL_TRANSPORT, { data: {} })).status(), 'AF entretien POST transport').toBe(HTTP.FORBIDDEN)
      expect((await afCcdpaa.get(URL_TRANSPORT)).status(), 'AF ccdpaa GET transport').toBe(HTTP.FORBIDDEN)

      // EMPLOYE : jamais de gestion planning.
      expect((await employe.get(URL_TRANSPORT)).status(), 'EMPLOYE GET transport').toBe(HTTP.FORBIDDEN)
      expect((await employe.post(URL_TRANSPORT, { data: {} })).status(), 'EMPLOYE POST transport').toBe(HTTP.FORBIDDEN)

      // mon-planning : réservé aux EMPLOYE (requireRole, pas requireModule).
      expect((await sa.get('/api/admin/mon-planning')).status(), 'SA mon-planning').toBe(HTTP.FORBIDDEN)
      expect((await afEntretien.get('/api/admin/mon-planning')).status(), 'AF entretien mon-planning').toBe(HTTP.FORBIDDEN)
      expect((await afCcdpaa.get('/api/admin/mon-planning')).status(), 'AF ccdpaa mon-planning').toBe(HTTP.FORBIDDEN)
    } finally {
      await afEntretien.dispose()
      await afCcdpaa.dispose()
      await employe.dispose()
      await sa.dispose()
    }
  })

  test('400 sur params/query/body invalides, jamais 500', async ({}, testInfo) => {
    const sa = await apiAs(testInfo, SUPER_ADMIN)
    try {
      expect((await sa.get('/api/admin/planning/holding')).status(), 'site hors enum').toBe(HTTP.BAD_REQUEST)
      expect(
        (await sa.get(`${URL_TRANSPORT}?semaine=${ajouterJoursIso(SEMAINE, -1)}`)).status(),
        'semaine = dimanche',
      ).toBe(HTTP.BAD_REQUEST)
      expect((await sa.get(`${URL_TRANSPORT}?semaine=2026-13-45`)).status(), 'date calendaire invalide').toBe(HTTP.BAD_REQUEST)
      expect((await sa.get(`${URL_TRANSPORT}?semaine=09-10-2026`)).status(), 'format non ISO').toBe(HTTP.BAD_REQUEST)
      expect((await sa.get(`${URL_TRANSPORT}?inconnu=x`)).status(), 'query stricte').toBe(HTTP.BAD_REQUEST)
      expect((await sa.patch(`${URL_TRANSPORT}/abc`, { data: { lieu: 'Bureau' } })).status(), 'uuid malformé').toBe(HTTP.BAD_REQUEST)

      const debut = instantQuebec(SEMAINE, '10:00').toISOString()
      const fin = instantQuebec(SEMAINE, '12:00').toISOString()
      expect(
        (await sa.post(URL_TRANSPORT, { data: { employeUuid: UUID_INCONNU, dateDebut: debut, dateFin: fin, lieu: '   ' } })).status(),
        'lieu vide (trim)',
      ).toBe(HTTP.BAD_REQUEST)
      expect(
        (await sa.post(URL_TRANSPORT, { data: { employeUuid: UUID_INCONNU, dateDebut: `${SEMAINE} 10:00`, dateFin: fin, lieu: 'Bureau' } })).status(),
        'début non ISO',
      ).toBe(HTTP.BAD_REQUEST)
      expect(
        (await sa.post(URL_TRANSPORT, { data: { employeUuid: UUID_INCONNU, dateDebut: debut, dateFin: 'pas-une-date', lieu: 'Bureau' } })).status(),
        'dateFin malformée',
      ).toBe(HTTP.BAD_REQUEST)
      expect(
        (
          await sa.post(URL_TRANSPORT, {
            data: { employeUuid: UUID_INCONNU, dateDebut: debut, dateFin: fin, lieu: 'Bureau', extra: 'x' },
          })
        ).status(),
        'champ inconnu (strict)',
      ).toBe(HTTP.BAD_REQUEST)
    } finally {
      await sa.dispose()
    }
  })

  test('GET semaine seedée : employés + quarts du site uniquement, triés, no-store, sans fuite', async ({}, testInfo) => {
    const sa = await apiAs(testInfo, SUPER_ADMIN)
    try {
      const res = await sa.get(`${URL_TRANSPORT}?semaine=${SEMAINE}`)
      expect(res.status()).toBe(HTTP.OK)
      expect(res.headers()['cache-control']).toContain('no-store')
      const dto = (await res.json()) as PlanningSemaineDto
      expect(dto.semaine).toBe(SEMAINE)

      expect(dto.employes.some((e) => e.nom === nomEmployeSeed(0)), 'employé Un').toBe(true)
      expect(dto.employes.some((e) => e.nom === nomEmployeSeed(1)), 'employé Deux').toBe(true)
      const inactif = dto.employes.find((e) => e.nom === nomEmployeSeed(2))
      expect(inactif?.actif, 'employé inactif').toBe(false)
      expect(dto.employes.every((e) => typeof e.actif === 'boolean')).toBe(true)

      expect(dto.quarts.length).toBeGreaterThanOrEqual(3)
      const debut = instantQuebec(SEMAINE, '00:00').toISOString()
      const fin = instantQuebec(ajouterJoursIso(SEMAINE, 7), '00:00').toISOString()
      expect(dto.quarts.every((q) => q.dateDebut >= debut && q.dateDebut < fin), 'quarts dans la fenêtre').toBe(true)
      const dates = dto.quarts.map((q) => q.dateDebut)
      expect([...dates].sort(), 'quarts triés par dateDebut').toEqual(dates)
      expect(
        dto.quarts.some((q) => q.titre === 'Nuit e2e' && q.dateFin > q.dateDebut),
        'nuit seedée (dimanche → lundi suivant)',
      ).toBe(true)
      // Scoping : tout quart renvoyé appartient à un employé du site (les employés hors
      // site — Awa entretien — n'y apparaissent jamais).
      expect(dto.quarts.every((q) => dto.employes.some((e) => e.uuid === q.employeUuid)), 'quarts scoped au site').toBe(true)
      expect(clesInterdites(dto)).toEqual([])
    } finally {
      await sa.dispose()
    }
  })

  test('GET semaine vide : employés listés, quarts [] ; borne exacte : lundi+7 00:00 exclu', async ({}, testInfo) => {
    const sa = await apiAs(testInfo, SUPER_ADMIN)
    try {
      const vide = ajouterJoursIso(SEMAINE, 14)
      const res = await sa.get(`${URL_TRANSPORT}?semaine=${vide}`)
      expect(res.status()).toBe(HTTP.OK)
      const dto = (await res.json()) as PlanningSemaineDto
      expect(dto.semaine).toBe(vide)
      expect(dto.employes.length).toBeGreaterThanOrEqual(3)
      expect(dto.quarts).toEqual([])

      // Borne exacte de fenêtre (exclusion `lt fin`) : un quart posé pile à lundi+7 00:00
      // appartient à la semaine SUIVANTE, jamais à celle-ci.
      const liste = (await (await sa.get(`${URL_TRANSPORT}?semaine=${SEMAINE}`)).json()) as PlanningSemaineDto
      const actif = liste.employes.find((e) => e.actif)!
      const borne = await sa.post(`${URL_TRANSPORT}`, {
        data: {
          employeUuid: actif.uuid,
          dateDebut: instantQuebec(ajouterJoursIso(SEMAINE, 7), '00:00').toISOString(),
          dateFin: instantQuebec(ajouterJoursIso(SEMAINE, 7), '08:00').toISOString(),
          lieu: 'Borne fenêtre E2E',
        },
      })
      expect(borne.status()).toBe(HTTP.CREATED)
      const uuidBorne = ((await borne.json()) as AdminQuartDto).uuid
      try {
        const semaine = (await (await sa.get(`${URL_TRANSPORT}?semaine=${SEMAINE}`)).json()) as PlanningSemaineDto
        expect(semaine.quarts.some((q) => q.uuid === uuidBorne), 'exclu de la semaine courante').toBe(false)
        const suivante = (await (await sa.get(`${URL_TRANSPORT}?semaine=${ajouterJoursIso(SEMAINE, 7)}`)).json()) as PlanningSemaineDto
        expect(suivante.quarts.some((q) => q.uuid === uuidBorne), 'inclus dans la semaine suivante').toBe(true)
      } finally {
        await sa.delete(`${URL_TRANSPORT}/${uuidBorne}`)
      }
    } finally {
      await sa.dispose()
    }
  })

  test('POST 201 + DTO à jour ; 400 inactif, 404 autre site, 404 inconnu', async ({}, testInfo) => {
    const sa = await apiAs(testInfo, SUPER_ADMIN)
    try {
      const liste = (await (await sa.get(`${URL_TRANSPORT}?semaine=${SEMAINE}`)).json()) as PlanningSemaineDto
      const actif = liste.employes.find((e) => e.nom === nomEmployeSeed(0))!
      const inactif = liste.employes.find((e) => e.nom === nomEmployeSeed(2))!
      const entretien = (await (await sa.get(`${URL_ENTRETIEN}?semaine=${SEMAINE}`)).json()) as PlanningSemaineDto
      const awa = entretien.employes.find((e) => e.nom === 'Awa Diallo')!

      const corps = corpsQuart(actif.uuid, instantQuebec(SEMAINE, '10:00'), instantQuebec(SEMAINE, '12:00'), 'Bureau E2E API', 'Quart API')
      const cree = await sa.post(URL_TRANSPORT, { data: corps })
      expect(cree.status()).toBe(HTTP.CREATED)
      const dto = (await cree.json()) as AdminQuartDto
      expect(dto.uuid).toBeTruthy()
      expect(dto.employeUuid).toBe(actif.uuid)
      expect(dto.titre).toBe('Quart API')
      expect(dto.lieu).toBe('Bureau E2E API')
      expect(dto.dateDebut).toBe(corps.dateDebut)
      expect(dto.dateFin).toBe(corps.dateFin)
      expect(clesInterdites(dto)).toEqual([])
      quartApiUuid = dto.uuid

      expect(
        (
          await sa.post(URL_TRANSPORT, {
            data: corpsQuart(inactif.uuid, instantQuebec(SEMAINE, '10:00'), instantQuebec(SEMAINE, '12:00'), 'Bureau'),
          })
        ).status(),
        'employé inactif',
      ).toBe(HTTP.BAD_REQUEST)
      expect(
        (await sa.post(URL_TRANSPORT, { data: corpsQuart(awa.uuid, instantQuebec(SEMAINE, '10:00'), instantQuebec(SEMAINE, '12:00'), 'Bureau') })).status(),
        'employé d’une autre filiale',
      ).toBe(HTTP.NOT_FOUND)
      expect(
        (await sa.post(URL_TRANSPORT, { data: corpsQuart(UUID_INCONNU, instantQuebec(SEMAINE, '10:00'), instantQuebec(SEMAINE, '12:00'), 'Bureau') })).status(),
        'employé inconnu',
      ).toBe(HTTP.NOT_FOUND)
    } finally {
      await sa.dispose()
    }
  })

  test('PATCH 200 + DTO à jour ; 404 uuid inconnu ; 404 uuid d’une autre filiale', async ({}, testInfo) => {
    const sa = await apiAs(testInfo, SUPER_ADMIN)
    try {
      expect(quartApiUuid, 'le quart créé par le POST doit exister').toBeTruthy()
      const maj = await sa.patch(`${URL_TRANSPORT}/${quartApiUuid}`, { data: { lieu: 'Bureau E2E modifié', titre: 'Quart API modifié' } })
      expect(maj.status()).toBe(HTTP.OK)
      const dto = (await maj.json()) as AdminQuartDto
      expect(dto.lieu).toBe('Bureau E2E modifié')
      expect(dto.titre).toBe('Quart API modifié')
      expect(clesInterdites(dto)).toEqual([])

      // Champ vidé → null : l'ancien titre est réellement effacé (index partiel non applicable ici).
      const efface = await sa.patch(`${URL_TRANSPORT}/${quartApiUuid}`, { data: { titre: '' } })
      expect(efface.status()).toBe(HTTP.OK)
      expect(((await efface.json()) as AdminQuartDto).titre, 'titre vidé → null, pas conservé').toBeNull()

      expect((await sa.patch(`${URL_TRANSPORT}/${UUID_INCONNU}`, { data: { lieu: 'Bureau' } })).status(), 'uuid inconnu').toBe(
        HTTP.NOT_FOUND,
      )

      // Quart d'une autre filiale : créé sur entretien (Awa), jamais résolu côté transport.
      const entretien = (await (await sa.get(`${URL_ENTRETIEN}?semaine=${SEMAINE}`)).json()) as PlanningSemaineDto
      const awa = entretien.employes.find((e) => e.nom === 'Awa Diallo')!
      const autre = await sa.post(
        URL_ENTRETIEN,
        {
          data: corpsQuart(awa.uuid, instantQuebec(SEMAINE, '20:00'), instantQuebec(SEMAINE, '22:00'), 'Clinique E2E', `[E2E ${marqueur}] Autre filiale`),
        },
      )
      expect(autre.status()).toBe(HTTP.CREATED)
      quartAutreUuid = ((await autre.json()) as AdminQuartDto).uuid
      expect((await sa.patch(`${URL_TRANSPORT}/${quartAutreUuid}`, { data: { lieu: 'Bureau' } })).status(), 'uuid hors filiale').toBe(
        HTTP.NOT_FOUND,
      )
    } finally {
      // --purge-planning supprime aussi les titres `[E2E <marqueur>]…` (filet de sécurité).
      if (quartAutreUuid) await sa.delete(`${URL_ENTRETIEN}/${quartAutreUuid}`)
      quartAutreUuid = ''
      await sa.dispose()
    }
  })

  test('nuit : 22:00→06:00 lendemain accepté ; fin < début acceptée (durée +24 h)', async ({}, testInfo) => {
    const sa = await apiAs(testInfo, SUPER_ADMIN)
    const uuids: string[] = []
    try {
      const entretien = (await (await sa.get(`${URL_ENTRETIEN}?semaine=${SEMAINE}`)).json()) as PlanningSemaineDto
      const awa = entretien.employes.find((e) => e.nom === 'Awa Diallo')!

      // Nuit classique : dimanche 22:00 → lundi suivant 06:00 (fin > début, aucun refus).
      const nuit = await sa.post(
        URL_ENTRETIEN,
        {
          data: corpsQuart(
            awa.uuid,
            instantQuebec(ajouterJoursIso(SEMAINE, 6), '22:00'),
            instantQuebec(ajouterJoursIso(SEMAINE, 7), '06:00'),
            'Clinique E2E',
            `[E2E ${marqueur}] Nuit dimanche`,
          ),
        },
      )
      expect(nuit.status(), 'nuit lendemain').toBe(HTTP.CREATED)
      uuids.push(((await nuit.json()) as AdminQuartDto).uuid)

      // Fin < début : aucune vérification, durée +24 h (mercredi 22:00 → mercredi 06:00 = 8 h).
      const croise = await sa.post(
        URL_ENTRETIEN,
        {
          data: corpsQuart(
            awa.uuid,
            instantQuebec(ajouterJoursIso(SEMAINE, 2), '22:00'),
            instantQuebec(ajouterJoursIso(SEMAINE, 2), '06:00'),
            'Clinique E2E',
            `[E2E ${marqueur}] Croisé`,
          ),
        },
      )
      expect(croise.status(), 'fin < début acceptée').toBe(HTTP.CREATED)
      uuids.push(((await croise.json()) as AdminQuartDto).uuid)
    } finally {
      // --purge-planning supprime aussi les titres `[E2E <marqueur>]…` (filet de sécurité).
      for (const uuid of uuids) await sa.delete(`${URL_ENTRETIEN}/${uuid}`)
      await sa.dispose()
    }
  })

  test('DELETE 204 puis 404', async ({}, testInfo) => {
    const sa = await apiAs(testInfo, SUPER_ADMIN)
    try {
      const liste = (await (await sa.get(`${URL_TRANSPORT}?semaine=${SEMAINE}`)).json()) as PlanningSemaineDto
      const actif = liste.employes.find((e) => e.nom === nomEmployeSeed(1))!
      const cree = await sa.post(
        URL_TRANSPORT,
        { data: corpsQuart(actif.uuid, instantQuebec(SEMAINE, '13:00'), instantQuebec(SEMAINE, '15:00'), 'Bureau E2E delete') },
      )
      expect(cree.status()).toBe(HTTP.CREATED)
      const uuid = ((await cree.json()) as AdminQuartDto).uuid

      expect((await sa.delete(`${URL_TRANSPORT}/${uuid}`)).status()).toBe(HTTP.NO_CONTENT)
      expect((await sa.delete(`${URL_TRANSPORT}/${uuid}`)).status(), 'second DELETE').toBe(HTTP.NOT_FOUND)
      expect((await sa.patch(`${URL_TRANSPORT}/${uuid}`, { data: { lieu: 'Bureau' } })).status(), 'PATCH après suppression').toBe(
        HTTP.NOT_FOUND,
      )
    } finally {
      await sa.dispose()
    }
  })

  test('mon-planning : 200 EMPLOYE, total cohérent (nuit +24 h), ?semaine= navigue ; 403 SA/AF', async ({}, testInfo) => {
    const employe = await apiAs(testInfo, EMPLOYE_ENTRETIEN)
    const sa = await apiAs(testInfo, SUPER_ADMIN)
    const uuids: string[] = []
    try {
      // Quarts posés sur le dossier seedé d'Awa (entretien), titres `[E2E <marqueur>]…` purgés
      // aussi par --purge-planning : la lecture employé n'a aucun param client (DEC-29).
      const entretien = (await (await sa.get(`${URL_ENTRETIEN}?semaine=${SEMAINE}`)).json()) as PlanningSemaineDto
      const awa = entretien.employes.find((e) => e.nom === 'Awa Diallo')!
      for (const [jourDebut, jourFin, titre] of [
        [ajouterJoursIso(SEMAINE, 2), ajouterJoursIso(SEMAINE, 2), `[E2E ${marqueur}] Croisé`],
        [ajouterJoursIso(SEMAINE, 6), ajouterJoursIso(SEMAINE, 7), `[E2E ${marqueur}] Nuit dimanche`],
      ] as const) {
        const cree = await sa.post(
          URL_ENTRETIEN,
          {
            data: corpsQuart(
              awa.uuid,
              instantQuebec(jourDebut, '22:00'),
              instantQuebec(jourFin, '06:00'),
              'Clinique E2E',
              titre,
            ),
          },
        )
        expect(cree.status(), titre).toBe(HTTP.CREATED)
        uuids.push(((await cree.json()) as AdminQuartDto).uuid)
      }

      const res = await employe.get('/api/admin/mon-planning')
      expect(res.status()).toBe(HTTP.OK)
      const dto = (await res.json()) as MonPlanningDto
      expect(dto.semaine).toBe(SEMAINE)
      expect(dto.employe.nom).toBe('Awa Diallo')
      expect(dto.quarts.some((q) => q.titre === `[E2E ${marqueur}] Croisé`), 'quart croisé dans la semaine').toBe(true)
      expect(dto.quarts.some((q) => q.titre === `[E2E ${marqueur}] Nuit dimanche`), 'quart nuit dans la semaine').toBe(true)
      expect(dto.totalHeures).toBe(
        totalHeures(dto.quarts.map((q) => ({ dateDebut: new Date(q.dateDebut), dateFin: new Date(q.dateFin) }))),
        'total cohérent avec le calcul partagé',
      )
      expect(dto.totalHeures).toBeGreaterThan(0)
      expect(clesInterdites(dto)).toEqual([])

      const vide = ajouterJoursIso(SEMAINE, 14)
      const horsSemaine = (await (await employe.get(`/api/admin/mon-planning?semaine=${vide}`)).json()) as MonPlanningDto
      expect(horsSemaine.semaine).toBe(vide)
      expect(horsSemaine.quarts).toEqual([])
      expect(horsSemaine.totalHeures).toBe(0)
    } finally {
      for (const uuid of uuids) await sa.delete(`${URL_ENTRETIEN}/${uuid}`)
      await employe.dispose()
      await sa.dispose()
    }
  })
})

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------
test.describe('UI planning', () => {
  test.describe('SUPER_ADMIN', () => {
    test.beforeEach(async ({ context }) => {
      await loginAs(context, SUPER_ADMIN)
    })

    test('nav : 3 items planning, jamais « Mon planning »', async ({ page }) => {
      const shell = new AdminShell(page)
      await page.goto('/admin')
      await shell.ouvrirNavigation()
      await expect(shell.navigation.getByRole('link', { name: 'Planning — Entretien' })).toBeVisible()
      await expect(shell.navigation.getByRole('link', { name: 'Planning — Transport' })).toBeVisible()
      await expect(shell.navigation.getByRole('link', { name: 'Planning — CCDPAA' })).toBeVisible()
      await expect(shell.navigation.getByRole('link', { name: 'Mon planning' })).toHaveCount(0)
      await shell.fermerNavigation()
    })

    test('grille seedée : quarts, nuit, badge inactif, lieu', async ({ page }) => {
      await page.goto(`/admin/transport/planning?semaine=${SEMAINE}`)
      await expect(page.getByRole('heading', { name: 'Planning hebdomadaire' })).toBeVisible()
      await expect(page.getByText('08:00–16:00')).toBeVisible()
      await expect(page.getByText('09:30–17:30')).toBeVisible()
      await expect(page.getByText('22:00–06:00'), 'nuit dimanche → lundi suivant').toBeVisible()
      await expect(page.getByText(`Entrepôt E2E ${marqueur}`).first()).toBeVisible()
      // Le badge « Inactif » n'existe que dans la table (≥1024px) : l'employé inactif n'a pas
      // de quart, la liste mobile (<1024px) ne montre que les employés avec quarts.
      if (!estMobile(page)) {
        const ligneInactif = page.getByRole('row').filter({ hasText: nomEmployeSeed(2) })
        await expect(ligneInactif.locator('[data-slot="badge"]')).toHaveText('Inactif')
      }
    })

    test('création via le « + » du jour : dialog, toast exact, quart dans la grille', async ({ page }) => {
      await page.goto(`/admin/transport/planning?semaine=${SEMAINE}`)
      await expect(page.getByRole('heading', { name: 'Planning hebdomadaire' })).toBeVisible()

      await page.getByRole('button', { name: `Ajouter un quart le ${formatDateLongue(SEMAINE)}` }).first().click()
      const dialog = page.getByRole('dialog')
      // BUG T2 constaté (non corrigé ici, app/** hors périmètre) : le <DialogTitle> est vide —
      // le ref local `titre` de VeeValidate (defineField, QuartDialog.vue) masque le prop dans le
      // template. L'ouverture est donc assertée sur le formulaire, pas sur le titre.
      await expect(dialog.getByRole('combobox', { name: 'Employé *' }), 'dialog ouvert').toBeVisible()
      await dialog.getByRole('combobox', { name: 'Employé *' }).click()
      await page.getByRole('option', { name: `${nomEmployeSeed(1)} — Manutentionnaire`, exact: true }).click()
      await dialog.getByLabel('Date *').fill(SEMAINE)
      // Horaire distinct du quart créé par le test API POST (10:00–12:00, resté en DB) :
      // getByText sur la plage doit rester unique (strict mode).
      await dialog.getByLabel('Début *').fill('14:00')
      await dialog.getByLabel('Fin *').fill('16:00')
      await dialog.getByLabel('Lieu *').fill(`Bureau E2E ${marqueur}`)
      await dialog.getByRole('button', { name: 'Enregistrer' }).click()

      await expect(page.getByText(TOAST_AJOUT, { exact: true })).toBeVisible()
      await expect(dialog, 'dialog fermé après succès').toBeHidden()
      await expect(page.getByText('14:00–16:00')).toBeVisible()
    })

    test('édition : toast exact et grille à jour', async ({ page }) => {
      await page.goto(`/admin/transport/planning?semaine=${SEMAINE}`)
      await expect(page.getByRole('heading', { name: 'Planning hebdomadaire' })).toBeVisible()

      await page.getByRole('button', { name: `Modifier le quart de ${nomEmployeSeed(0)}` }).first().click()
      const dialog = page.getByRole('dialog')
      // Même bug T2 (DialogTitle vide) : le pré-remplissage est asserté sur les champs.
      await expect(dialog.getByRole('combobox', { name: 'Employé *' }), 'dialog ouvert').toBeVisible()
      await expect(dialog.getByLabel('Lieu *'), 'pré-rempli avec le lieu du quart').toHaveValue(`Entrepôt E2E ${marqueur}`)
      await dialog.getByLabel('Lieu *').fill('Entrepôt modifié e2e')
      await dialog.getByRole('button', { name: 'Enregistrer' }).click()

      await expect(page.getByText(TOAST_MAJ, { exact: true })).toBeVisible()
      await expect(dialog, 'dialog fermé après succès').toBeHidden()
      await expect(page.getByText('Entrepôt modifié e2e')).toBeVisible()
    })

    test('suppression : AlertDialog, toast exact, quart retiré', async ({ page }) => {
      await page.goto(`/admin/transport/planning?semaine=${SEMAINE}`)
      await expect(page.getByRole('heading', { name: 'Planning hebdomadaire' })).toBeVisible()
      await expect(page.getByText('08:00–16:00'), 'quart seedé du lundi (Un)').toBeVisible()

      await page.getByRole('button', { name: `Supprimer le quart de ${nomEmployeSeed(0)}` }).first().click()
      const alerte = page.getByRole('alertdialog')
      await expect(alerte.getByText('Supprimer ce quart ?')).toBeVisible()
      await expect(alerte.getByText("L'employé ne le verra plus dans son planning.")).toBeVisible()
      await alerte.getByRole('button', { name: 'Supprimer', exact: true }).click()

      await expect(page.getByText(TOAST_SUPPRESSION, { exact: true })).toBeVisible()
      await expect(alerte, 'dialog fermé après succès').toBeHidden()
      await expect(page.getByText('08:00–16:00')).toHaveCount(0)
    })

    test('navigation semaine dans l’URL, survit au rechargement, semaine vide', async ({ page }) => {
      await page.goto(`/admin/transport/planning?semaine=${SEMAINE}`)
      await expect(page.getByRole('heading', { name: 'Planning hebdomadaire' })).toBeVisible()

      await page.getByRole('button', { name: 'Semaine suivante' }).click()
      await expect(page).toHaveURL((url) => url.searchParams.get('semaine') === ajouterJoursIso(SEMAINE, 7))
      await page.reload()
      await expect(page, 'l’URL survit au rechargement').toHaveURL((url) => url.searchParams.get('semaine') === ajouterJoursIso(SEMAINE, 7))
      await expect(
        page.getByText(new RegExp(`^\\s*Semaine du ${formatDateLongue(ajouterJoursIso(SEMAINE, 7))}$`)),
      ).toBeVisible()

      // Semaine vide : aucun quart affiché. La table (≥1024px) liste toujours les employés ;
      // la liste empilée (<1024px) ne montre que les employés avec quarts.
      await expect(page.getByText('08:00–16:00')).toHaveCount(0)
      if (!estMobile(page)) await expect(page.getByText(nomEmployeSeed(0))).toBeVisible()

      await page.getByRole('button', { name: 'Cette semaine' }).click()
      await expect(page).toHaveURL((url) => !url.searchParams.get('semaine') || url.searchParams.get('semaine') === SEMAINE)
    })

    test('375px : pas de défilement horizontal, cibles ≥44px, liste par jour', async ({ page }) => {
      test.skip(!estMobile(page), 'critère mobile (375 px)')
      await page.goto(`/admin/transport/planning?semaine=${SEMAINE}`)
      await expect(page.getByRole('heading', { name: 'Planning hebdomadaire' })).toBeVisible()
      const { sw, cw } = await page.evaluate(() => ({ sw: document.body.scrollWidth, cw: document.body.clientWidth }))
      expect(sw).toBeLessThanOrEqual(cw + 1)

      const plus = page.getByRole('button', { name: `Ajouter un quart le ${formatDateLongue(SEMAINE)}` }).first()
      const boite = await plus.boundingBox()
      expect(boite, 'bouton « + » du jour').toBeTruthy()
      expect(boite!.height, 'hauteur du bouton').toBeGreaterThanOrEqual(44)
      expect(boite!.width, 'largeur du bouton').toBeGreaterThanOrEqual(44)

      await expect(page.getByText('22:00–06:00'), 'quart de nuit dans la liste empilée').toBeVisible()
      // Le nom apparaît une fois par quart de l'employé (Deux en a plusieurs cette semaine).
      await expect(page.getByText(nomEmployeSeed(1)).first()).toBeVisible()
    })
  })

  test.describe('ADMIN_FILIALE entretien', () => {
    test.beforeEach(async ({ context }) => {
      await loginAs(context, ADMIN_FILIALE_ENTRETIEN)
    })

    test('item de nav restreint à sa filiale ; accès direct à transport → état erreur', async ({ page }) => {
      const shell = new AdminShell(page)
      await page.goto('/admin')
      await shell.ouvrirNavigation()
      await expect(shell.navigation.getByRole('link', { name: 'Planning — Entretien' })).toBeVisible()
      await expect(shell.navigation.getByRole('link', { name: 'Planning — Transport' })).toHaveCount(0)
      await expect(shell.navigation.getByRole('link', { name: 'Planning — CCDPAA' })).toHaveCount(0)
      await shell.fermerNavigation()

      await page.goto('/admin/transport/planning')
      await expect(page.getByRole('alert')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible()
    })
  })

  test.describe('EMPLOYE', () => {
    test.beforeEach(async ({ context }) => {
      await loginAs(context, EMPLOYE_ENTRETIEN)
    })

    test('nav : « Mon planning » seul ; /admin redirige vers /admin/mon-planning', async ({ page }) => {
      const shell = new AdminShell(page)
      await page.goto('/admin')
      await expect(page, 'redirection du tableau de bord').toHaveURL(/\/admin\/mon-planning/)
      await shell.ouvrirNavigation()
      await expect(shell.navigation.getByRole('link', { name: 'Mon planning' })).toBeVisible()
      await expect(shell.navigation.getByRole('link', { name: 'Planning — Entretien' })).toHaveCount(0)
      await expect(shell.navigation.getByRole('link', { name: 'Planning — Transport' })).toHaveCount(0)
      await expect(shell.navigation.getByRole('link', { name: 'Messages' })).toHaveCount(0)
      await shell.fermerNavigation()
    })

    test('lecture seule : aucun CRUD, total affiché, « Congé » sur les jours vides, semaine navigue', async ({ page }) => {
      await page.goto('/admin/mon-planning')
      await expect(page.getByRole('heading', { name: 'Mon planning' })).toBeVisible()
      await expect(page.getByText(/h cette semaine/), 'total affiché').toBeVisible()
      await expect(page.getByText('Congé', { exact: true })).toHaveCount(7)
      await expect(page.getByRole('button', { name: /^Modifier le quart/ })).toHaveCount(0)
      await expect(page.getByRole('button', { name: /^Supprimer le quart/ })).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Ajouter un quart' })).toHaveCount(0)

      await page.getByRole('button', { name: 'Semaine suivante' }).click()
      await expect(page).toHaveURL((url) => url.searchParams.get('semaine') === ajouterJoursIso(SEMAINE, 7))
    })
  })
})
