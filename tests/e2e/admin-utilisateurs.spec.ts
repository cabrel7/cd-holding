// Lot 6 — /admin/utilisateurs (docs/specs/lot6-comptes.md §8). Exécuté contre le BUILD DE
// PRODUCTION, desktop (1440) + mobile (375 : liste et dialogs sans défilement horizontal,
// cibles ≥ 44 px).
//
// Isolation : `beforeAll` → `semerComptes(marqueur)` crée 3 comptes dédiés
// `comptes-{emp,af,sa}-<m>@example.test` (EMPLOYE/entretien, ADMIN_FILIALE/transport,
// SUPER_ADMIN sans filiale) dont les mots de passe GÉNÉRÉS remontent en JSON
// (`COMPTES_MDP_JSON=`, jamais écrits en dur — convention helpers/auth.ts). Ce sont les SEULS
// comptes MUTÉS (rôle, actif, mot de passe) : `admin@groupecd.ca` et les comptes seedés
// AF/EMPLOYE ne servent qu'aux lectures (403, nav) et à l'auto-garde (409 propre compte).
// Les comptes créés par les tests finissent tous par `-{m}@example.test`
// (`comptes-nouveau[-sa]-<m>`, `comptes-ui-<suffixe>-<m>`) : purgés en `afterAll` par
// `purgerComptes(marqueur)` + `purgerCompte` explicite pour les deux du test 6. Chaque test
// qui désactive/rétrograde restaure l'état avant de finir. Workers 1 + ordre déterministe :
// les tests 7 à 11 s'appuient sur les uuids résolus dès le test 3, le test 15 sur les états
// laissés par les précédents.
//
// Rate-limit (scope `admin-comptes`, max 10 / 15 min / IP + utilisateur — D15) : TOUTE
// mutation (POST/PATCH/reset) porte une IP TEST-NET fraîche via un helper résilient (retry
// IP neuve sur 429 inattendu — miroir `postMotDePasse` de admin-parametres.spec.ts). Le test
// 429 garde SA propre IP hors pool (`IP_QUOTA_HORS_POOL`, repli auto-guérissant sur le pool).
// Les tests UI ne peuvent pas rejouer le `fetch` du navigateur : leur IP est sondée avant
// d'être confiée à la page (`ipUiVierge`, 1 POST invalide = 1 hit sur le budget 10) via
// `setExtraHTTPHeaders` APRÈS `loginAs`. Login (scope `login`, max 5 / IP) : toute tentative
// manuelle part avec une IP fraîche ; un login réussi remet son bucket à zéro et les échecs,
// isolés sur des IP distinctes, n'accumulent jamais.
import { randomUUID } from 'node:crypto'
import { test, expect, request as pwRequest } from '@playwright/test'
import type { APIRequestContext, APIResponse, BrowserContext, Locator, Page, TestInfo } from '@playwright/test'
import { ADMIN_PAGE_SIZE, ROLE_LABELS } from '#shared/config/admin'
import type { AdminCompteDto, AdminPage, AdminProfilDto, AdminSiteSummary } from '#shared/types/admin'
import { ROLES } from '#shared/utils/roles'
import { ADMIN_FILIALE_ENTRETIEN, EMPLOYE_ENTRETIEN, SUPER_ADMIN, loginAs } from './helpers/auth'
import type { AdminAccount } from './helpers/auth'
import { purgerCompte, purgerComptes, semerComptes } from './helpers/db'
import type { ComptesSemes } from './helpers/db'
import { nextTestIp } from './helpers/ip'
import { nouveauMarqueur } from './fixtures/admin-data'
import { AdminShell, apiAs, clesInterdites, estMobile } from './fixtures/admin-pages'

const HTTP = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  TOO_MANY_REQUESTS: 429,
} as const
const ROUTE_COMPTES = '/api/admin/utilisateurs'
const ROUTE_PROFIL = '/api/admin/profil'
const ROUTE_LOGIN = '/api/auth/login'
const ROUTE_SITES = '/api/admin/sites'
const SESSION_INVALIDE = 'Session invalide, veuillez vous reconnecter'
const ACCES_REFUSE = 'Accès refusé'
const INTROUVABLE = 'Introuvable'
const MSG_EMAIL = 'Un compte existe déjà avec cet email.'
const MSG_COMPTE_PROPRE = 'Impossible de modifier votre propre compte.'
const MSG_RESET_PROPRE = 'Utilisez la page Paramètres pour modifier votre propre mot de passe.'
const CLES_COMPTE = ['actif', 'company', 'email', 'nom', 'role', 'uuid'] as const
const CLES_PAGE = ['items', 'page', 'pageCount', 'pageSize', 'total'] as const
const MAX_IP_RETRIES = 8
/** Salve du test 429 : max=10 autorisés, la 11e requête doit être refusée. */
const NOMBRE_REQUETES_QUOTA = 11
/**
 * Suffixe HORS pool `nextTestIp` (qui ne tire que 1..253) : le test 429 consomme son quota
 * entier sur cette IP fixe — il ne pollue jamais le pool partagé des autres tests. Repli sur
 * le pool (boucle auto-guérissante) si .254 est elle-même saturée par un run récent.
 */
const IP_QUOTA_HORS_POOL = '203.0.113.254'

let marqueur = ''
let comptes: ComptesSemes = {
  emp: { email: '', motDePasse: '' },
  af: { email: '', motDePasse: '' },
  sa: { email: '', motDePasse: '' },
}
let emailNouveau = ''
let emailNouveauSa = ''
/** uuids résolus une fois (test 3) puis réutilisés par les tests 7 à 11 — remis à zéro par run. */
let uuidAdmin = ''
let uuidEmp = ''
let uuidSa = ''

function baseURL(testInfo: TestInfo): string {
  return (testInfo.project.use.baseURL as string | undefined) || 'http://localhost:3200'
}

/**
 * Mutation POST/PATCH avec une IP fraîche par tentative : retire une nouvelle IP sur un 429
 * inattendu (quota résiduel d'un run précédent sur cette IP). Ne sert PAS au test 429, qui a
 * besoin d'observer son propre quota.
 */
async function mutationResiliente(
  api: APIRequestContext,
  methode: 'post' | 'patch',
  url: string,
  data?: Record<string, unknown>,
): Promise<APIResponse> {
  for (let tentative = 0; tentative < MAX_IP_RETRIES; tentative++) {
    const headers = { 'x-forwarded-for': nextTestIp() }
    const res =
      methode === 'post'
        ? await api.post(url, data === undefined ? { headers } : { headers, data })
        : await api.patch(url, { headers, data: data ?? {} })
    if (res.status() !== HTTP.TOO_MANY_REQUESTS) return res
  }
  throw new Error(`Mutation ${methode.toUpperCase()} ${url} toujours limitée (429) après ${MAX_IP_RETRIES} IP fraîches.`)
}

const postCreation = (api: APIRequestContext, data: Record<string, unknown>): Promise<APIResponse> =>
  mutationResiliente(api, 'post', ROUTE_COMPTES, data)
const patchCompte = (api: APIRequestContext, uuid: string, data: Record<string, unknown>): Promise<APIResponse> =>
  mutationResiliente(api, 'patch', `${ROUTE_COMPTES}/${uuid}`, data)
const postReset = (api: APIRequestContext, uuid: string): Promise<APIResponse> =>
  mutationResiliente(api, 'post', `${ROUTE_COMPTES}/${uuid}/mot-de-passe`)

async function profilDe(api: APIRequestContext): Promise<AdminProfilDto> {
  const res = await api.get(ROUTE_PROFIL)
  expect(res.status()).toBe(HTTP.OK)
  return (await res.json()) as AdminProfilDto
}

async function uuidParEmail(api: APIRequestContext, email: string): Promise<string> {
  const res = await api.get(`${ROUTE_COMPTES}?q=${encodeURIComponent(email)}`)
  expect(res.status()).toBe(HTTP.OK)
  const liste = (await res.json()) as AdminPage<AdminCompteDto>
  const trouve = liste.items.find((item) => item.email === email)
  expect(trouve, `compte ${email} présent dans la liste`).toBeTruthy()
  return trouve!.uuid
}

/** uuid du compte seedé SA (auto-garde) et des 3 comptes du marqueur — résolution lazy, cachée. */
async function resoudreUuids(api: APIRequestContext): Promise<void> {
  if (uuidEmp !== '') return
  uuidAdmin = (await profilDe(api)).uuid
  uuidEmp = await uuidParEmail(api, comptes.emp.email)
  uuidSa = await uuidParEmail(api, comptes.sa.email)
}

/** Tentative de login avec IP fraîche (le scope `login` est par IP, succès = reset du bucket). */
async function tenterLogin(anon: APIRequestContext, email: string, password: string): Promise<number> {
  const res = await anon.post(ROUTE_LOGIN, {
    headers: { 'x-forwarded-for': nextTestIp() },
    data: { email, password },
  })
  return res.status()
}

async function listeSites(api: APIRequestContext): Promise<readonly AdminSiteSummary[]> {
  const res = await api.get(ROUTE_SITES)
  expect(res.status()).toBe(HTTP.OK)
  return (await res.json()) as readonly AdminSiteSummary[]
}

function libelleSite(sites: readonly AdminSiteSummary[], slug: string): string {
  const site = sites.find((s) => s.slug === slug)
  expect(site, `filiale ${slug} présente dans /api/admin/sites`).toBeTruthy()
  return site!.nomCourt ?? site!.nom
}

test.beforeAll(() => {
  marqueur = nouveauMarqueur('u')
  comptes = semerComptes(marqueur)
  emailNouveau = `comptes-nouveau-${marqueur}@example.test`
  emailNouveauSa = `comptes-nouveau-sa-${marqueur}@example.test`
  // Reset explicite : le module est réutilisé entre les projets mobile et desktop.
  uuidAdmin = ''
  uuidEmp = ''
  uuidSa = ''
})

test.afterAll(() => {
  purgerComptes(marqueur)
  purgerCompte(emailNouveau)
  purgerCompte(emailNouveauSa)
})

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
test.describe('API /api/admin/utilisateurs', () => {
  test('401 sans session sur les 4 routes, message jamais technique', async ({}, testInfo) => {
    const anon = await pwRequest.newContext({ baseURL: baseURL(testInfo) })
    try {
      const reponses = await Promise.all([
        anon.get(ROUTE_COMPTES),
        anon.post(ROUTE_COMPTES, { data: {} }),
        anon.patch(`${ROUTE_COMPTES}/${randomUUID()}`, { data: {} }),
        anon.post(`${ROUTE_COMPTES}/${randomUUID()}/mot-de-passe`, { data: {} }),
      ])
      for (const [index, res] of reponses.entries()) {
        expect(res.status(), `route ${index} sans session`).toBe(HTTP.UNAUTHORIZED)
      }
      const corpsGet = (await reponses[0]!.json()) as { statusMessage: string }
      expect(corpsGet.statusMessage).toBe(SESSION_INVALIDE)
      for (const [index, res] of reponses.entries()) {
        const brut = await res.text()
        expect(brut, `réponse ${index} sans détail technique`).not.toMatch(/passwordHash|prisma|stack|\/home\//i)
      }
    } finally {
      await anon.dispose()
    }
  })

  test('403 hors SUPER_ADMIN : AF et EMPLOYE seed sur les 4 routes', async ({}, testInfo) => {
    for (const compte of [ADMIN_FILIALE_ENTRETIEN, EMPLOYE_ENTRETIEN]) {
      const api = await apiAs(testInfo, compte)
      try {
        const get = await api.get(ROUTE_COMPTES)
        expect(get.status(), `${compte.email} GET`).toBe(HTTP.FORBIDDEN)
        expect(((await get.json()) as { statusMessage: string }).statusMessage).toBe(ACCES_REFUSE)
        expect((await api.post(ROUTE_COMPTES, { data: {} })).status(), `${compte.email} POST`).toBe(HTTP.FORBIDDEN)
        expect(
          (await api.patch(`${ROUTE_COMPTES}/${randomUUID()}`, { data: {} })).status(),
          `${compte.email} PATCH`,
        ).toBe(HTTP.FORBIDDEN)
        expect(
          (await api.post(`${ROUTE_COMPTES}/${randomUUID()}/mot-de-passe`, { data: {} })).status(),
          `${compte.email} reset`,
        ).toBe(HTTP.FORBIDDEN)
      } finally {
        await api.dispose()
      }
    }
  })

  test('GET liste : 200, DTO strict, no-store, tri, pagination, filtres, SA sans filiale', async ({}, testInfo) => {
    const api = await apiAs(testInfo, SUPER_ADMIN)
    try {
      await resoudreUuids(api)

      const res = await api.get(ROUTE_COMPTES)
      expect(res.status()).toBe(HTTP.OK)
      expect(res.headers()['cache-control']).toContain('no-store')
      const liste = (await res.json()) as AdminPage<AdminCompteDto>
      expect(Object.keys(liste).sort()).toEqual(CLES_PAGE)
      expect(liste.page).toBe(1)
      expect(liste.pageSize).toBe(ADMIN_PAGE_SIZE)
      expect(liste.total).toBeGreaterThanOrEqual(3)
      expect(liste.pageCount).toBeGreaterThanOrEqual(1)

      for (const item of liste.items) {
        expect(Object.keys(item).sort()).toEqual(CLES_COMPTE)
        if (item.company !== null) expect(Object.keys(item.company).sort()).toEqual(['nom', 'slug', 'uuid'])
        expect(item.uuid).toMatch(/^[0-9a-f-]{36}$/)
      }
      expect(clesInterdites(liste)).toEqual([])
      const brut = JSON.stringify(liste)
      expect(brut).not.toContain('passwordHash')
      expect(brut).not.toContain('passwordChangedAt')

      const sa = liste.items.find((item) => item.role === ROLES.SUPER_ADMIN)
      expect(sa, 'au moins un compte SA (le seed) dans la liste').toBeTruthy()
      expect(sa!.company).toBeNull()

      // Tri sur `nom` : ordre RELATIF des 3 comptes marqueur (prefixes identiques, A < E < S
      // dans toute collation) — indépendant de la collation Postgres sur les noms du seed.
      // Filtré par marqueur : la page 1 de la liste complète ne contiendrait plus forcément les
      // 3 comptes dès que la table `User` dépasse ADMIN_PAGE_SIZE (comptes d'autres specs).
      const triReponse = await api.get(`${ROUTE_COMPTES}?q=${encodeURIComponent(`E2E ${marqueur}`)}`)
      expect(triReponse.status()).toBe(HTTP.OK)
      const triPage = (await triReponse.json()) as AdminPage<AdminCompteDto>
      const nomsMarqueur = [`Comptes AF E2E ${marqueur}`, `Comptes EMP E2E ${marqueur}`, `Comptes SA E2E ${marqueur}`]
      const positions = nomsMarqueur.map((nom) => triPage.items.findIndex((item) => item.nom === nom))
      expect(positions.every((position) => position >= 0), 'les 3 comptes marqueur sont sur la page filtrée').toBe(true)
      expect(positions[0]!).toBeLessThan(positions[1]!)
      expect(positions[1]!).toBeLessThan(positions[2]!)

      const hors = await api.get(`${ROUTE_COMPTES}?page=999`)
      expect(hors.status()).toBe(HTTP.OK)
      const horsPage = (await hors.json()) as AdminPage<AdminCompteDto>
      expect(horsPage.page).toBe(999)
      expect(horsPage.items).toEqual([])
      expect(horsPage.total).toBe(liste.total)

      const parRole = await api.get(`${ROUTE_COMPTES}?role=${ROLES.ADMIN_FILIALE}`)
      expect(parRole.status()).toBe(HTTP.OK)
      const rolePage = (await parRole.json()) as AdminPage<AdminCompteDto>
      expect(rolePage.items.length).toBeGreaterThanOrEqual(1)
      expect(rolePage.items.every((item) => item.role === ROLES.ADMIN_FILIALE)).toBe(true)

      const inactifs = await api.get(`${ROUTE_COMPTES}?actif=false`)
      expect(inactifs.status()).toBe(HTTP.OK)
      const inactifPage = (await inactifs.json()) as AdminPage<AdminCompteDto>
      expect(inactifPage.items.every((item) => item.actif === false)).toBe(true)

      const recherche = await api.get(`${ROUTE_COMPTES}?q=Comptes`)
      expect(recherche.status()).toBe(HTTP.OK)
      const qPage = (await recherche.json()) as AdminPage<AdminCompteDto>
      const emails = new Set(qPage.items.map((item) => item.email))
      for (const compte of [comptes.emp, comptes.af, comptes.sa]) {
        expect(emails.has(compte.email), `q=Comptes retrouve ${compte.email}`).toBe(true)
      }
    } finally {
      await api.dispose()
    }
  })

  test('POST 400 : nom manquant, email invalide, rôle invalide, site manquant/SA/holding, clé inconnue', async ({}, testInfo) => {
    const api = await apiAs(testInfo, SUPER_ADMIN)
    try {
      const base = {
        nom: 'Validation E2E',
        email: `comptes-validation-${marqueur}@example.test`,
        role: ROLES.EMPLOYE,
        site: 'entretien',
      }
      const cas: readonly (readonly [string, Record<string, unknown>])[] = [
        ['nom manquant', { email: base.email, role: ROLES.EMPLOYE, site: 'entretien' }],
        ['email invalide', { ...base, email: 'pas-un-courriel' }],
        ['rôle invalide', { ...base, role: 'DIRECTEUR' }],
        ['site manquant pour EMPLOYE', { nom: base.nom, email: base.email, role: ROLES.EMPLOYE }],
        ['site fourni pour SA', { ...base, role: ROLES.SUPER_ADMIN }],
        ["site 'holding'", { ...base, role: ROLES.ADMIN_FILIALE, site: 'holding' }],
        ['clé inconnue (.strict())', { ...base, inconnu: true }],
      ]
      for (const [libelle, data] of cas) {
        const res = await postCreation(api, data)
        expect(res.status(), libelle).toBe(HTTP.BAD_REQUEST)
      }
    } finally {
      await api.dispose()
    }
  })

  test('POST 409 : email déjà utilisé → message exact', async ({}, testInfo) => {
    const api = await apiAs(testInfo, SUPER_ADMIN)
    try {
      const res = await postCreation(api, {
        nom: 'Doublon E2E',
        email: comptes.emp.email,
        role: ROLES.EMPLOYE,
        site: 'entretien',
      })
      expect(res.status()).toBe(HTTP.CONFLICT)
      expect(((await res.json()) as { statusMessage: string }).statusMessage).toBe(MSG_EMAIL)
    } finally {
      await api.dispose()
    }
  })

  test('POST 201 : création EMPLOYE (login mdp temporaire) puis création SA sans filiale', async ({}, testInfo) => {
    const api = await apiAs(testInfo, SUPER_ADMIN)
    try {
      const res = await postCreation(api, {
        nom: 'Compte Nouveau E2E',
        email: emailNouveau,
        role: ROLES.EMPLOYE,
        site: 'entretien',
      })
      expect(res.status()).toBe(HTTP.CREATED)
      expect(res.headers()['cache-control']).toContain('no-store')
      const corps = (await res.json()) as { compte: AdminCompteDto; motDePasseTemporaire: string }
      expect(Object.keys(corps).sort()).toEqual(['compte', 'motDePasseTemporaire'])
      expect(corps.motDePasseTemporaire).toHaveLength(16)
      expect(Object.keys(corps.compte).sort()).toEqual(CLES_COMPTE)
      expect(corps.compte.email).toBe(emailNouveau)
      expect(corps.compte.actif).toBe(true)
      expect(corps.compte.company?.slug).toBe('entretien')
      expect(clesInterdites(corps)).toEqual([])

      const anon = await pwRequest.newContext({ baseURL: baseURL(testInfo) })
      try {
        const faux = await tenterLogin(anon, emailNouveau, 'MotDePasseFauxE2e1')
        expect(faux, 'mot de passe quelconque rejeté').toBe(HTTP.UNAUTHORIZED)
        const ok = await tenterLogin(anon, emailNouveau, corps.motDePasseTemporaire)
        expect(ok, 'mot de passe temporaire accepté').toBe(HTTP.OK)
      } finally {
        await anon.dispose()
      }

      const resSa = await postCreation(api, {
        nom: 'Compte Nouveau SA E2E',
        email: emailNouveauSa,
        role: ROLES.SUPER_ADMIN,
      })
      expect(resSa.status()).toBe(HTTP.CREATED)
      const corpsSa = (await resSa.json()) as { compte: AdminCompteDto; motDePasseTemporaire: string }
      expect(corpsSa.compte.company, 'un SA ne rattaché à aucune filiale (D7)').toBeNull()
      expect(corpsSa.motDePasseTemporaire).toHaveLength(16)
    } finally {
      await api.dispose()
    }
  })

  test('413 corps > 4 Ko et 429 : 11 PATCH même IP → 400 ×10 puis 429 + Retry-After', async ({}, testInfo) => {
    const api = await apiAs(testInfo, SUPER_ADMIN)
    await resoudreUuids(api)
    try {
      const trop = await patchCompte(api, uuidEmp, { nom: 'a'.repeat(5_000) })
      expect(trop.status()).toBe(HTTP.PAYLOAD_TOO_LARGE)

      let statuts: number[] = []
      let dernieresEntetes: Record<string, string> = {}
      // Le quota frappe AVANT la validation de l'uuid (§3) : IP vierge d'abord (hors pool),
      // repli sur le pool si un run récent a déjà saturé .254.
      for (let tentative = 0; tentative < MAX_IP_RETRIES; tentative++) {
        const ip = tentative === 0 ? IP_QUOTA_HORS_POOL : nextTestIp()
        statuts = []
        let ipEntamee = false
        for (let i = 0; i < NOMBRE_REQUETES_QUOTA; i++) {
          const res = await api.patch(`${ROUTE_COMPTES}/pas-un-uuid`, {
            headers: { 'x-forwarded-for': ip },
            data: {},
          })
          statuts.push(res.status())
          dernieresEntetes = res.headers()
          if (i < NOMBRE_REQUETES_QUOTA - 1 && res.status() === HTTP.TOO_MANY_REQUESTS) {
            ipEntamee = true
            break
          }
        }
        if (!ipEntamee) break
      }
      expect(statuts).toEqual([
        HTTP.BAD_REQUEST, HTTP.BAD_REQUEST, HTTP.BAD_REQUEST, HTTP.BAD_REQUEST, HTTP.BAD_REQUEST,
        HTTP.BAD_REQUEST, HTTP.BAD_REQUEST, HTTP.BAD_REQUEST, HTTP.BAD_REQUEST, HTTP.BAD_REQUEST,
        HTTP.TOO_MANY_REQUESTS,
      ])
      expect(dernieresEntetes['retry-after'], 'Retry-After numérique').toMatch(/^\d+$/)
    } finally {
      await api.dispose()
    }
  })

  test('PATCH 200 : nom, puis rôle EMPLOYE → AF (la session de la cible meurt, D12), restauration', async ({}, testInfo) => {
    const api = await apiAs(testInfo, SUPER_ADMIN)
    await resoudreUuids(api)
    const nomOrigine = `Comptes EMP E2E ${marqueur}`
    const nomModifie = `${nomOrigine} modifié`
    try {
      const p1 = await patchCompte(api, uuidEmp, { nom: nomModifie })
      expect(p1.status()).toBe(HTTP.OK)
      const dto1 = (await p1.json()) as AdminCompteDto
      expect(dto1.nom).toBe(nomModifie)
      expect(Object.keys(dto1).sort()).toEqual(CLES_COMPTE)
      expect(clesInterdites(dto1)).toEqual([])

      const emp: AdminAccount = { email: comptes.emp.email, password: comptes.emp.motDePasse }
      const empApi = await apiAs(testInfo, emp)
      try {
        expect((await empApi.get(ROUTE_PROFIL)).status(), 'session cible vivante').toBe(HTTP.OK)

        const p2 = await patchCompte(api, uuidEmp, { role: ROLES.ADMIN_FILIALE, site: 'transport' })
        expect(p2.status()).toBe(HTTP.OK)
        const dto2 = (await p2.json()) as AdminCompteDto
        expect(dto2.role).toBe(ROLES.ADMIN_FILIALE)
        expect(dto2.company?.slug).toBe('transport')

        const morte = await empApi.get(ROUTE_PROFIL)
        expect(morte.status(), 'rôle modifié → 401 (D12)').toBe(HTTP.UNAUTHORIZED)
        expect(((await morte.json()) as { statusMessage: string }).statusMessage).toBe(SESSION_INVALIDE)
      } finally {
        await empApi.dispose()
      }

      // Re-login : la nouvelle session porte le rôle de la base.
      const empApi2 = await apiAs(testInfo, emp)
      try {
        const profil = await profilDe(empApi2)
        expect(profil.role).toBe(ROLES.ADMIN_FILIALE)
      } finally {
        await empApi2.dispose()
      }

      const restaure = await patchCompte(api, uuidEmp, {
        nom: nomOrigine,
        role: ROLES.EMPLOYE,
        site: 'entretien',
      })
      expect(restaure.status()).toBe(HTTP.OK)
      const dto3 = (await restaure.json()) as AdminCompteDto
      expect(dto3.nom).toBe(nomOrigine)
      expect(dto3.role).toBe(ROLES.EMPLOYE)
      expect(dto3.company?.slug).toBe('entretien')
    } finally {
      await api.dispose()
    }
  })

  test('PATCH gardes : propre compte 409, uuid inconnu 404, uuid malformé 400 (jamais 500)', async ({}, testInfo) => {
    const api = await apiAs(testInfo, SUPER_ADMIN)
    await resoudreUuids(api)
    try {
      const propre = await patchCompte(api, uuidAdmin, { nom: 'Tentative Soi' })
      expect(propre.status()).toBe(HTTP.CONFLICT)
      expect(((await propre.json()) as { statusMessage: string }).statusMessage).toBe(MSG_COMPTE_PROPRE)

      const inconnu = await patchCompte(api, randomUUID(), { nom: 'Inconnu E2E' })
      expect(inconnu.status()).toBe(HTTP.NOT_FOUND)
      expect(((await inconnu.json()) as { statusMessage: string }).statusMessage).toBe(INTROUVABLE)

      const malforme = await patchCompte(api, 'pas-un-uuid', { nom: 'Malformé E2E' })
      expect(malforme.status()).toBe(HTTP.BAD_REQUEST)
    } finally {
      await api.dispose()
    }
  })

  test('désactivation : sessions de la cible 401, login refusé, réactivation restaurée ; SA seed désactivable', async ({}, testInfo) => {
    const api = await apiAs(testInfo, SUPER_ADMIN)
    await resoudreUuids(api)
    const emp: AdminAccount = { email: comptes.emp.email, password: comptes.emp.motDePasse }
    const empApi = await apiAs(testInfo, emp)
    try {
      expect((await empApi.get(ROUTE_PROFIL)).status()).toBe(HTTP.OK)

      const off = await patchCompte(api, uuidEmp, { actif: false })
      expect(off.status()).toBe(HTTP.OK)
      expect(((await off.json()) as AdminCompteDto).actif).toBe(false)

      const morte = await empApi.get(ROUTE_PROFIL)
      expect(morte.status(), 'compte inactif → 401 (D8)').toBe(HTTP.UNAUTHORIZED)

      const anon = await pwRequest.newContext({ baseURL: baseURL(testInfo) })
      try {
        const refuse = await tenterLogin(anon, comptes.emp.email, comptes.emp.motDePasse)
        expect(refuse, 'login dun compte désactivé refusé').toBe(HTTP.UNAUTHORIZED)
      } finally {
        await anon.dispose()
      }

      const on = await patchCompte(api, uuidEmp, { actif: true })
      expect(on.status()).toBe(HTTP.OK)
      expect(((await on.json()) as AdminCompteDto).actif).toBe(true)

      const anon2 = await pwRequest.newContext({ baseURL: baseURL(testInfo) })
      try {
        const accepte = await tenterLogin(anon2, comptes.emp.email, comptes.emp.motDePasse)
        expect(accepte, 'login restauré après réactivation').toBe(HTTP.OK)
      } finally {
        await anon2.dispose()
      }
    } finally {
      await empApi.dispose()
    }

    try {
      // Le compte SA du marqueur n'est PAS le dernier SA actif (le seed admin l'est) : la
      // garde D4 ne bloque pas. Le cas « dernier SA » est couvert en unit (comptes.test.ts).
      const saOff = await patchCompte(api, uuidSa, { actif: false })
      expect(saOff.status()).toBe(HTTP.OK)
      expect(((await saOff.json()) as AdminCompteDto).actif).toBe(false)

      const saOn = await patchCompte(api, uuidSa, { actif: true })
      expect(saOn.status()).toBe(HTTP.OK)
      expect(((await saOn.json()) as AdminCompteDto).actif).toBe(true)
    } finally {
      await api.dispose()
    }
  })

  test('reset : 200 + mdp temporaire, sessions cible 401, ancien mdp 401, reset de soi 409', async ({}, testInfo) => {
    const api = await apiAs(testInfo, SUPER_ADMIN)
    await resoudreUuids(api)
    let mdpTemporaire = ''
    const emp: AdminAccount = { email: comptes.emp.email, password: comptes.emp.motDePasse }
    const empApi = await apiAs(testInfo, emp)
    try {
      expect((await empApi.get(ROUTE_PROFIL)).status()).toBe(HTTP.OK)

      const reset = await postReset(api, uuidEmp)
      expect(reset.status()).toBe(HTTP.OK)
      expect(reset.headers()['cache-control']).toContain('no-store')
      const corps = (await reset.json()) as { motDePasseTemporaire: string }
      expect(Object.keys(corps)).toEqual(['motDePasseTemporaire'])
      expect(corps.motDePasseTemporaire).toHaveLength(16)
      mdpTemporaire = corps.motDePasseTemporaire

      const morte = await empApi.get(ROUTE_PROFIL)
      expect(morte.status(), 'reset → sessions de la cible 401 (D11)').toBe(HTTP.UNAUTHORIZED)
      expect(((await morte.json()) as { statusMessage: string }).statusMessage).toBe(SESSION_INVALIDE)
    } finally {
      await empApi.dispose()
    }

    const anon = await pwRequest.newContext({ baseURL: baseURL(testInfo) })
    try {
      const ancien = await tenterLogin(anon, comptes.emp.email, comptes.emp.motDePasse)
      expect(ancien, 'ancien mot de passe rejeté').toBe(HTTP.UNAUTHORIZED)
      const nouveau = await tenterLogin(anon, comptes.emp.email, mdpTemporaire)
      expect(nouveau, 'mot de passe temporaire accepté').toBe(HTTP.OK)
    } finally {
      await anon.dispose()
    }

    try {
      const soi = await postReset(api, uuidAdmin)
      expect(soi.status()).toBe(HTTP.CONFLICT)
      expect(((await soi.json()) as { statusMessage: string }).statusMessage).toBe(MSG_RESET_PROPRE)
    } finally {
      await api.dispose()
    }
  })
})

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------
test.describe('UI /admin/utilisateurs', () => {
  /** Sonde une IP du pool avant de la confier à la page : 1 POST invalide = 1 hit sur le budget 10. */
  async function ipUiVierge(context: BrowserContext): Promise<string> {
    for (let tentative = 0; tentative < MAX_IP_RETRIES; tentative++) {
      const ip = nextTestIp()
      const probe = await context.request.post(ROUTE_COMPTES, {
        headers: { 'x-forwarded-for': ip },
        data: {},
      })
      if (probe.status() !== HTTP.TOO_MANY_REQUESTS) return ip
    }
    throw new Error(`Aucune IP UI vierge (scope admin-comptes) après ${MAX_IP_RETRIES} tentatives.`)
  }

  /** Connexion d'abord (loginAs sur `context.request`), puis IP sondée pour toutes les requêtes de la page. */
  async function ouvrirUtilisateurs(page: Page, context: BrowserContext): Promise<void> {
    await loginAs(context, SUPER_ADMIN)
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': await ipUiVierge(context) })
    await page.goto('/admin/utilisateurs')
    await expect(page.getByRole('heading', { level: 1, name: 'Utilisateurs' })).toBeVisible()
  }

  /** Ligne de tableau (≥ lg) ou élément de liste (< lg) contenant le courriel du compte. */
  function ligneDe(page: Page, email: string): Locator {
    return page.getByRole('row').or(page.getByRole('listitem')).filter({ hasText: email }).first()
  }

  /** Libellé d'action : bouton-icône aria-label au desktop, bouton texte à 375 px. */
  function boutonAction(
    ligne: Locator,
    mobile: boolean,
    libelle: 'Modifier' | 'Réinitialiser le mot de passe' | 'Désactiver' | 'Réactiver',
    nom: string,
  ): Locator {
    if (mobile) return ligne.getByRole('button', { name: libelle, exact: true })
    const aria =
      libelle === 'Réinitialiser le mot de passe' ? `Réinitialiser le mot de passe de ${nom}` : `${libelle} ${nom}`
    return ligne.getByRole('button', { name: aria, exact: true })
  }

  /** Dialog identifié par son titre (le formulaire et le mdp temporaire peuvent coexister pendant la transition). */
  function dialogDe(page: Page, titre: string): Locator {
    return page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: titre, exact: true }) })
  }

  /** Fermeture via le bouton du footer : le X partagé porte aussi un sr-only « Fermer » (double résolution). */
  function fermerTemporaire(temp: Locator): Promise<void> {
    return temp.locator('[data-slot="dialog-footer"]').getByRole('button', { name: 'Fermer', exact: true }).click()
  }

  const sansScrollHorizontal = async (page: Page): Promise<void> => {
    const { sw, cw } = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
    }))
    expect(sw).toBeLessThanOrEqual(cw + 1)
  }

  test("ADMIN_FILIALE : renvoyé sur /admin, aucun lien « Utilisateurs » dans la nav", async ({ page, context }) => {
    await loginAs(context, ADMIN_FILIALE_ENTRETIEN)
    await page.goto('/admin/utilisateurs')
    await expect(page).toHaveURL(/\/admin$/)

    const shell = new AdminShell(page)
    await shell.ouvrirNavigation()
    await expect(shell.navigation.getByRole('link', { name: 'Utilisateurs', exact: true })).toHaveCount(0)
    await expect(shell.navigation.getByRole('link', { name: 'Paramètres', exact: true })).toBeVisible()
    await shell.fermerNavigation()
  })

  test('EMPLOYE : renvoyé sur /admin/mon-planning, aucun lien « Utilisateurs » dans la nav', async ({ page, context }) => {
    await loginAs(context, EMPLOYE_ENTRETIEN)
    await page.goto('/admin/utilisateurs')
    await expect(page).toHaveURL(/\/admin\/mon-planning/)

    const shell = new AdminShell(page)
    await shell.ouvrirNavigation()
    await expect(shell.navigation.getByRole('link', { name: 'Utilisateurs', exact: true })).toHaveCount(0)
    await shell.fermerNavigation()
  })

  test('SUPER_ADMIN : nav avec « Utilisateurs », création via dialog → mdp temporaire affiché une fois', async ({
    page,
    context,
  }) => {
    await ouvrirUtilisateurs(page, context)
    await expect(
      page.getByText('Gérez les comptes de la console : nom, rôle, filiale et mot de passe.', { exact: true }),
    ).toBeVisible()

    const shell = new AdminShell(page)
    await shell.ouvrirNavigation()
    await expect(shell.navigation.getByRole('link', { name: 'Utilisateurs', exact: true })).toBeVisible()
    await shell.fermerNavigation()

    const sites = await listeSites(context.request)
    const libelleTransport = libelleSite(sites, 'transport')

    const suffixe = nouveauMarqueur('i')
    const emailUi = `comptes-ui-${suffixe}-${marqueur}@example.test`
    const nomUi = `Compte UI E2E ${suffixe}`

    const creations: number[] = []
    let mdpServeur = ''
    page.on('response', (res) => {
      if (res.request().method() === 'POST' && new URL(res.url()).pathname === ROUTE_COMPTES) {
        creations.push(res.status())
        if (res.status() === HTTP.CREATED) {
          void res
            .json()
            .then((corps: { motDePasseTemporaire?: string }) => {
              mdpServeur = corps.motDePasseTemporaire ?? ''
            })
            .catch(() => undefined)
        }
      }
    })

    await page.getByRole('button', { name: 'Nouveau compte', exact: true }).click()
    const dialog = dialogDe(page, 'Nouveau compte')
    await expect(dialog.getByRole('heading', { name: 'Nouveau compte' })).toBeVisible()

    // Validation cliente : soumission vide → erreurs sous les champs, AUCUNE requête réseau.
    await dialog.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(dialog.getByRole('alert').first()).toBeVisible()
    expect(creations, 'aucune requête POST sur un formulaire invalide').toHaveLength(0)

    // Rôle par défaut « Administrateur de filiale » (choix explicite requis pour un SA) + filiale.
    await dialog.getByLabel(/^Nom/).fill(nomUi)
    await dialog.getByLabel(/^Courriel/).fill(emailUi)
    await dialog.getByRole('combobox', { name: 'Filiale' }).click()
    await page.getByRole('option', { name: libelleTransport, exact: true }).click()
    await dialog.getByRole('button', { name: 'Enregistrer' }).click()

    await expect(page.getByText('Compte créé.', { exact: true }).first()).toBeVisible()
    expect(creations).toEqual([HTTP.CREATED])

    // Le dialog mdp temporaire s'ouvre APRÈS le 201 et affiche exactement la valeur reçue (D14).
    const temp = dialogDe(page, 'Mot de passe temporaire')
    await expect(temp).toBeVisible()
    await expect.poll(() => mdpServeur.length, { timeout: 10_000 }).toBe(16)
    await expect(temp.locator('#compte-mdp-temporaire')).toHaveValue(mdpServeur)
    await temp.getByRole('button', { name: 'Afficher le mot de passe' }).click()
    await expect(temp.locator('#compte-mdp-temporaire')).toHaveAttribute('type', 'text')

    await temp.getByRole('button', { name: 'Copier le mot de passe' }).click()
    await expect(temp.getByRole('status')).toContainText(/presse-papiers|copié/i)
    if (estMobile(page)) await sansScrollHorizontal(page)

    await fermerTemporaire(temp)
    await expect(page.getByRole('dialog')).toHaveCount(0)

    const ligne = ligneDe(page, emailUi)
    await expect(ligne).toBeVisible()
    await expect(ligne.getByText(nomUi, { exact: true })).toBeVisible()
  })

  test('conflit email : 409 sous le champ courriel, dialog ouvert', async ({ page, context }) => {
    await ouvrirUtilisateurs(page, context)
    const sites = await listeSites(context.request)
    const libelleTransport = libelleSite(sites, 'transport')

    await page.getByRole('button', { name: 'Nouveau compte', exact: true }).click()
    const dialog = dialogDe(page, 'Nouveau compte')
    await dialog.getByLabel(/^Nom/).fill('Conflit E2E')
    await dialog.getByLabel(/^Courriel/).fill(SUPER_ADMIN.email)
    await dialog.getByRole('combobox', { name: 'Filiale' }).click()
    await page.getByRole('option', { name: libelleTransport, exact: true }).click()
    await dialog.getByRole('button', { name: 'Enregistrer' }).click()

    // L'erreur serveur apparaît sous le champ courriel (role=alert) — sans dépendre des classes
    // Tailwind du conteneur.
    await expect(dialog.getByRole('alert').filter({ hasText: MSG_EMAIL })).toHaveText(MSG_EMAIL)
    await expect(dialog).toBeVisible()
    await expect(page).toHaveURL(/\/admin\/utilisateurs/)
  })

  test("filtre Statut : « Inactif » écrit ?actif=false (valeur du schéma) et reste sélectionné", async ({ page, context }) => {
    await ouvrirUtilisateurs(page, context)
    // Régression revue : les options doivent valoir 'true'/'false' (schéma `actif`), pas les
    // clés de STATUT_COMPTE_LABELS — sinon `useAdminListQuery` invalide la clé et le filtre
    // est un no-op qui rebondit sur « Tous les statuts ».
    await page.getByLabel('Statut', { exact: true }).click()
    await page.getByRole('option', { name: 'Inactif', exact: true }).click()
    await expect(page).toHaveURL(/actif=false/)
    await expect(page.getByLabel('Statut', { exact: true })).toContainText('Inactif')
  })

  test('édition : pré-remplissage, courriel immuable, filiale masquée pour un SA, badge rôle mis à jour', async ({
    page,
    context,
  }) => {
    await ouvrirUtilisateurs(page, context)
    const sites = await listeSites(context.request)
    const libelleEntretien = libelleSite(sites, 'entretien')
    const nomEmp = `Comptes EMP E2E ${marqueur}`
    const nomSa = `Comptes SA E2E ${marqueur}`

    // Pré-remplissage EMPLOYE : nom, courriel readonly, rôle, filiale.
    await boutonAction(ligneDe(page, comptes.emp.email), estMobile(page), 'Modifier', nomEmp).click()
    let dialog = dialogDe(page, 'Modifier le compte')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel(/^Nom/)).toHaveValue(nomEmp)
    await expect(dialog.getByLabel(/^Courriel/)).toHaveValue(comptes.emp.email)
    await expect(dialog.getByLabel(/^Courriel/)).toHaveAttribute('readonly', '')
    await expect(dialog.getByRole('combobox', { name: 'Rôle' })).toContainText(ROLE_LABELS[ROLES.EMPLOYE])
    await expect(dialog.getByRole('combobox', { name: 'Filiale' })).toContainText(libelleEntretien)
    await dialog.getByRole('button', { name: 'Annuler', exact: true }).click()
    await expect(dialog).toHaveCount(0)

    // Un SA n'est rattaché à aucune filiale : le champ disparaît (D7).
    await boutonAction(ligneDe(page, comptes.sa.email), estMobile(page), 'Modifier', nomSa).click()
    dialog = dialogDe(page, 'Modifier le compte')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('combobox', { name: 'Filiale' })).toHaveCount(0)
    await expect(dialog.getByLabel(/^Courriel/)).toHaveAttribute('readonly', '')
    await dialog.getByRole('button', { name: 'Annuler', exact: true }).click()
    await expect(dialog).toHaveCount(0)

    // 1) renommage → toast + nom à jour.
    const nomModifie = `${nomEmp} modifié`
    await boutonAction(ligneDe(page, comptes.emp.email), estMobile(page), 'Modifier', nomEmp).click()
    dialog = dialogDe(page, 'Modifier le compte')
    await dialog.getByLabel(/^Nom/).fill(nomModifie)
    await dialog.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByText('Compte mis à jour.', { exact: true }).first()).toBeVisible()
    await expect(ligneDe(page, comptes.emp.email).getByText(nomModifie, { exact: true })).toBeVisible()

    // 2) changement de rôle → badge mis à jour (site entretien conservé, exigé pour l'AF).
    await boutonAction(ligneDe(page, comptes.emp.email), estMobile(page), 'Modifier', nomModifie).click()
    dialog = dialogDe(page, 'Modifier le compte')
    await dialog.getByRole('combobox', { name: 'Rôle' }).click()
    await page.getByRole('option', { name: ROLE_LABELS[ROLES.ADMIN_FILIALE], exact: true }).click()
    await dialog.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByText('Compte mis à jour.', { exact: true }).first()).toBeVisible()
    await expect(
      ligneDe(page, comptes.emp.email).getByText(ROLE_LABELS[ROLES.ADMIN_FILIALE], { exact: true }),
    ).toBeVisible()

    // 3) restauration rôle + nom.
    await boutonAction(ligneDe(page, comptes.emp.email), estMobile(page), 'Modifier', nomModifie).click()
    dialog = dialogDe(page, 'Modifier le compte')
    await dialog.getByLabel(/^Nom/).fill(nomEmp)
    await dialog.getByRole('combobox', { name: 'Rôle' }).click()
    await page.getByRole('option', { name: ROLE_LABELS[ROLES.EMPLOYE], exact: true }).click()
    await dialog.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByText('Compte mis à jour.', { exact: true }).first()).toBeVisible()
    const ligneEmp = ligneDe(page, comptes.emp.email)
    await expect(ligneEmp.getByText(nomEmp, { exact: true })).toBeVisible()
    await expect(ligneEmp.getByText(ROLE_LABELS[ROLES.EMPLOYE], { exact: true })).toBeVisible()
  })

  test('désactivation (AlertDialog, jamais une alerte navigateur) et réinitialisation de mot de passe', async ({
    page,
    context,
  }) => {
    const alertesNavigateur: string[] = []
    page.on('dialog', (dialog) => {
      alertesNavigateur.push(dialog.message())
      void dialog.dismiss()
    })

    await ouvrirUtilisateurs(page, context)
    const mobile = estMobile(page)
    const nomAf = `Comptes AF E2E ${marqueur}`
    const ligne = () => ligneDe(page, comptes.af.email)

    await boutonAction(ligne(), mobile, 'Désactiver', nomAf).click()
    const alertDialog = page.getByRole('alertdialog')
    await expect(alertDialog.getByRole('heading', { name: 'Désactiver ce compte ?' })).toBeVisible()
    await expect(
      alertDialog.getByText('Ce compte ne pourra plus se connecter et ses sessions seront fermées.', { exact: true }),
    ).toBeVisible()
    await alertDialog.getByRole('button', { name: 'Désactiver', exact: true }).click()
    await expect(page.getByText('Compte désactivé.', { exact: true }).first()).toBeVisible()
    await expect(ligne().getByText('Inactif', { exact: true })).toBeVisible()

    // Réactivation : directe (aucune confirmation destructrice).
    await boutonAction(ligne(), mobile, 'Réactiver', nomAf).click()
    await expect(page.getByText('Compte réactivé.', { exact: true }).first()).toBeVisible()
    await expect(ligne().getByText('Actif', { exact: true })).toBeVisible()

    // Reset : le dialog mdp temporaire ne s'ouvre qu'après le 200.
    await boutonAction(ligne(), mobile, 'Réinitialiser le mot de passe', nomAf).click()
    await expect(page.getByText('Mot de passe réinitialisé.', { exact: true }).first()).toBeVisible()
    const temp = dialogDe(page, 'Mot de passe temporaire')
    await expect(temp).toBeVisible()
    expect((await temp.locator('#compte-mdp-temporaire').inputValue()).length).toBe(16)
    await fermerTemporaire(temp)
    await expect(page.getByRole('dialog')).toHaveCount(0)

    expect(alertesNavigateur, 'aucune alert() native').toEqual([])
  })

  test('mobile 375 : liste et dialogs sans défilement horizontal, cibles ≥ 44 px', async ({ page, context }) => {
    test.skip(!estMobile(page), 'critère 375 px (projet mobile)')
    await ouvrirUtilisateurs(page, context)
    await sansScrollHorizontal(page)

    const boutonNouveau = page.getByRole('button', { name: 'Nouveau compte', exact: true })
    const boiteNouveau = await boutonNouveau.boundingBox()
    expect(boiteNouveau, 'bouton « Nouveau compte » mesurable').toBeTruthy()
    expect(boiteNouveau!.height).toBeGreaterThanOrEqual(44)
    expect(boiteNouveau!.width).toBeGreaterThanOrEqual(44)

    const nomAf = `Comptes AF E2E ${marqueur}`
    const ligne = ligneDe(page, comptes.af.email)
    for (const libelle of ['Modifier', 'Réinitialiser le mot de passe'] as const) {
      const cible = await boutonAction(ligne, true, libelle, nomAf).boundingBox()
      expect(cible, `bouton ${libelle} mesurable`).toBeTruthy()
      expect(cible!.height, `bouton ${libelle} : hauteur`).toBeGreaterThanOrEqual(44)
      expect(cible!.width, `bouton ${libelle} : largeur`).toBeGreaterThanOrEqual(44)
    }

    await boutonNouveau.click()
    const dialog = dialogDe(page, 'Nouveau compte')
    await expect(dialog).toBeVisible()
    await sansScrollHorizontal(page)
    for (const nom of ['Annuler', 'Enregistrer'] as const) {
      const bouton = dialog.getByRole('button', { name: nom, exact: true })
      const cible = await bouton.boundingBox()
      expect(cible, `bouton ${nom} mesurable`).toBeTruthy()
      expect(cible!.height, `bouton ${nom} : hauteur`).toBeGreaterThanOrEqual(44)
    }
    // Les selects du formulaire (Rôle/Filiale) valent 44 px sur mobile (revue UX M2).
    for (const nom of ['Rôle', 'Filiale'] as const) {
      const cible = await dialog.getByRole('combobox', { name: nom }).boundingBox()
      expect(cible, `select ${nom} mesurable`).toBeTruthy()
      expect(cible!.height, `select ${nom} : hauteur`).toBeGreaterThanOrEqual(44)
      expect(cible!.width, `select ${nom} : largeur`).toBeGreaterThanOrEqual(44)
    }
    await dialog.getByRole('button', { name: 'Annuler', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    // AlertDialog de désactivation : boutons ≥ 44 px (revue UX M1).
    await boutonAction(ligneDe(page, comptes.af.email), true, 'Désactiver', nomAf).click()
    const alertDialog = page.getByRole('alertdialog')
    await expect(alertDialog).toBeVisible()
    for (const nom of ['Annuler', 'Désactiver'] as const) {
      const cible = await alertDialog.getByRole('button', { name: nom, exact: true }).boundingBox()
      expect(cible, `bouton alertdialog ${nom} mesurable`).toBeTruthy()
      expect(cible!.height, `bouton alertdialog ${nom} : hauteur`).toBeGreaterThanOrEqual(44)
    }
    await alertDialog.getByRole('button', { name: 'Annuler', exact: true }).click()
    await expect(alertDialog).toHaveCount(0)
  })
})
