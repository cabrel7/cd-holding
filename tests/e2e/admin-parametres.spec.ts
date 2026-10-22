// Lot 5 — /admin/parametres (docs/specs/lot5-parametres.md §8). Exécuté contre le BUILD DE
// PRODUCTION, desktop + mobile (375 px : le dialog et ses cibles doivent tenir sans scroll
// horizontal).
//
// Isolation (D6) : `beforeAll` → `semerCompteMdp(marker)` crée le compte EMPLOYE dédié
// `parametres-<m>@example.test` (filiale entretien) dont le mot de passe GÉNÉRÉ (imprimé
// `MDP_E2E=` par le script, JAMAIS écrit en dur — convention helpers/auth.ts) suit
// l'enchaînement des changements via la variable `motDePasseCourant`. C'est le SEUL compte
// MUTÉ : les 3 comptes seedés (SUPER_ADMIN, AF entretien, EMPLOYE entretien) ne servent qu'aux
// lectures. `afterAll` → `purgerCompteMdp`. Workers 1 + ordre de fichier déterministe : les
// tests 4, 6 et UI s'appuient sur l'état laissé par les précédents.
//
// Rate-limit (scope `profil-mot-de-passe`, max 5 / 15 min / IP — server/utils/rate-limit.ts,
// D7) : TOUTE requête POST porte une IP TEST-NET fraîche (`nextTestIp`), le helper résilient
// en retire une nouvelle sur un 429 inattendu (miroir de `postContactResilient`,
// contact.spec.ts:94-106). Les tests UI ne peuvent pas rejouer le `fetch` du navigateur :
// leur IP est donc SONDÉE avant d'être confiée à la page (`ipUiVierge`, 1 POST diagnostique
// qui consomme 1 hit du quota — budget 5 largement suffisant). SAUF le test 429, qui doit
// observer SON propre quota sur une IP hors pool (`IP_QUOTA_HORS_POOL`). Le scope est
// distinct de `login` : la tentative de connexion « ancien mdp » (401) n'épuise pas le même
// bucket.
import { test, expect, request as pwRequest } from '@playwright/test'
import type { APIRequestContext, APIResponse, BrowserContext, Locator, Page, TestInfo } from '@playwright/test'
import { ROLE_LABELS } from '#shared/config/admin'
import type { AdminProfilDto } from '#shared/types/admin'
import { ROLES } from '#shared/utils/roles'
import { ADMIN_FILIALE_ENTRETIEN, EMPLOYE_ENTRETIEN, SUPER_ADMIN, loginAs } from './helpers/auth'
import type { AdminAccount } from './helpers/auth'
import { purgerCompteMdp, semerCompteMdp } from './helpers/db'
import { nextTestIp } from './helpers/ip'
import { nouveauMarqueur } from './fixtures/admin-data'
import { AdminShell, apiAs, clesInterdites, estMobile } from './fixtures/admin-pages'

const HTTP = { OK: 200, BAD_REQUEST: 400, UNAUTHORIZED: 401, PAYLOAD_TOO_LARGE: 413, TOO_MANY_REQUESTS: 429 } as const
const ROUTE_PROFIL = '/api/admin/profil'
const ROUTE_MDP = '/api/admin/profil/mot-de-passe'
const ROUTE_LOGIN = '/api/auth/login'
const MAX_IP_RETRIES = 8
/** Salve du test 429 : max=5 autorisés, la 6e requête doit être refusée. */
const NOMBRE_REQUETES_QUOTA = 6
/**
 * Suffixe HORS pool `nextTestIp` (qui ne tire que 1..253) : le test 429 consomme son quota
 * entier sur cette IP fixe — il ne pollue jamais le pool partagé des autres tests, ni n'en
 * subit l'état résiduel d'un run précédent. Repli sur le pool (boucle auto-guérissante) si
 * .254 est elle-même saturée par un run récent.
 */
const IP_QUOTA_HORS_POOL = '203.0.113.254'
const MESSAGE_ACTUEL_INCORRECT = 'Mot de passe actuel incorrect'
const TOAST_SUCCES = 'Mot de passe modifié.'
/** Libellé exact du prototype pour un compte holding sans filiale (parametres.vue). */
const FILIALE_HORS_ENTREPRISE = 'Aucune (accès groupe entier)'
/** Erreurs zod (shared/validation/auth.ts) — messages d'INTERFACE, pas du contenu éditable. */
const ERREUR_CONFIRMATION = 'Les mots de passe ne correspondent pas.'
const ERREUR_CONFIRMATION_VIDE = 'Veuillez confirmer le nouveau mot de passe.'
const ERREUR_LONGUEUR = /au moins 8 caractères/
const MDP_ACTUEL_FAUX = 'MotDePasseFauxE2e'
const MDP_COURT = 'court12' // 7 caractères : sous PASSWORD_MIN_LENGTH

let marqueur = ''
/** Suit l'enchaînement des changements (test 4 → test UI « succès ») : jamais un littéral. */
let motDePasseCourant = ''

/** Compte dédié (jamais en dur : e-mail dérivé du marqueur, mdp suivi par `motDePasseCourant`). */
function compteE2E(): AdminAccount {
  return {
    email: `parametres-${marqueur}@example.test`,
    get password() {
      return motDePasseCourant
    },
  }
}

/** Mot de passe neuf, distinct à chaque appel (≥ 8 caractères, jamais réutilisé). */
function mdpNouveau(): string {
  return `NouveauMdpE2e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

function baseURL(testInfo: TestInfo): string {
  return (testInfo.project.use.baseURL as string | undefined) || 'http://localhost:3200'
}

/**
 * POST mot-de-passe avec une IP fraîche par tentative : retire une nouvelle IP sur un 429
 * inattendu (quota résiduel d'un run précédent sur cette IP, pool de 253 suffixes partagé entre
 * les passes desktop/mobile). Ne sert PAS au test 429, qui a besoin d'observer son propre quota.
 */
async function postMotDePasse(api: APIRequestContext, data: Record<string, unknown>): Promise<APIResponse> {
  let res: APIResponse | undefined
  for (let attempt = 0; attempt < MAX_IP_RETRIES; attempt++) {
    res = await api.post(ROUTE_MDP, { headers: { 'x-forwarded-for': nextTestIp() }, data })
    if (res.status() !== HTTP.TOO_MANY_REQUESTS) return res
  }
  throw new Error(`POST ${ROUTE_MDP} toujours limité (429) après ${MAX_IP_RETRIES} IP fraîches.`)
}

async function profilDe(request: APIRequestContext): Promise<AdminProfilDto> {
  const res = await request.get(ROUTE_PROFIL)
  expect(res.status()).toBe(HTTP.OK)
  return (await res.json()) as AdminProfilDto
}

test.beforeAll(() => {
  marqueur = nouveauMarqueur('p')
  motDePasseCourant = semerCompteMdp(marqueur)
})

test.afterAll(() => {
  purgerCompteMdp(marqueur)
})

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
test.describe('API /api/admin/profil', () => {
  test('401 sans session sur GET et POST, message jamais technique', async ({}, testInfo) => {
    const anon = await pwRequest.newContext({ baseURL: baseURL(testInfo) })
    try {
      const get = await anon.get(ROUTE_PROFIL)
      expect(get.status(), 'GET sans session').toBe(HTTP.UNAUTHORIZED)
      const post = await anon.post(ROUTE_MDP, {
        headers: { 'x-forwarded-for': nextTestIp() },
        data: { actuel: MDP_ACTUEL_FAUX, nouveau: mdpNouveau() },
      })
      expect(post.status(), 'POST sans session').toBe(HTTP.UNAUTHORIZED)
      for (const [index, res] of [get, post].entries()) {
        const brut = await res.text()
        expect(brut, `réponse ${index} sans détail technique`).not.toMatch(/passwordHash|prisma|stack|\/home\//i)
      }
    } finally {
      await anon.dispose()
    }
  })

  test('GET profil : 200 × 3 rôles, no-store, DTO strict (5 champs, sans id ni passwordHash)', async ({}, testInfo) => {
    const cas = [
      { compte: SUPER_ADMIN, role: ROLES.SUPER_ADMIN, sansFiliale: true },
      { compte: ADMIN_FILIALE_ENTRETIEN, role: ROLES.ADMIN_FILIALE, sansFiliale: false },
      { compte: EMPLOYE_ENTRETIEN, role: ROLES.EMPLOYE, sansFiliale: false },
    ] as const
    for (const { compte, role, sansFiliale } of cas) {
      const api = await apiAs(testInfo, compte)
      try {
        const res = await api.get(ROUTE_PROFIL)
        expect(res.status(), compte.email).toBe(HTTP.OK)
        expect(res.headers()['cache-control'], compte.email).toContain('no-store')
        const dto = (await res.json()) as AdminProfilDto
        expect(dto.role, compte.email).toBe(role)
        // La session ne contient pas le courriel : le GET sort bien ce que la base sait.
        expect(dto.email, compte.email).toBe(compte.email)
        expect(dto.nom.length).toBeGreaterThan(0)
        expect(dto.uuid).toMatch(/^[0-9a-f-]{36}$/)
        // `toProfilDto` fait un pick explicite : jamais `{ ...row }`.
        expect(Object.keys(dto).sort()).toEqual(['company', 'email', 'nom', 'role', 'uuid'])
        expect(JSON.stringify(dto)).not.toContain('passwordHash')
        expect(clesInterdites(dto)).toEqual([])
        if (sansFiliale) {
          expect(dto.company, compte.email).toBeNull()
        } else {
          expect(dto.company?.nom.length ?? 0, `${compte.email} : company.nom`).toBeGreaterThan(0)
        }
      } finally {
        await api.dispose()
      }
    }
  })

  test('POST 400 : actuel faux, nouveau court, identique, corps vide, clé inconnue (.strict())', async ({}, testInfo) => {
    const api = await apiAs(testInfo, compteE2E())
    try {
      const faux = await postMotDePasse(api, { actuel: MDP_ACTUEL_FAUX, nouveau: mdpNouveau() })
      expect(faux.status(), 'actuel faux').toBe(HTTP.BAD_REQUEST)
      expect(((await faux.json()) as { statusMessage: string }).statusMessage).toBe(MESSAGE_ACTUEL_INCORRECT)

      expect((await postMotDePasse(api, { actuel: motDePasseCourant, nouveau: MDP_COURT })).status(), 'nouveau < 8').toBe(HTTP.BAD_REQUEST)
      expect(
        (await postMotDePasse(api, { actuel: motDePasseCourant, nouveau: motDePasseCourant })).status(),
        'nouveau == actuel',
      ).toBe(HTTP.BAD_REQUEST)
      expect((await postMotDePasse(api, {})).status(), 'corps vide').toBe(HTTP.BAD_REQUEST)
      expect((await postMotDePasse(api, { actuel: motDePasseCourant })).status(), 'champ nouveau manquant').toBe(HTTP.BAD_REQUEST)
      // `confirmation` n'existe que côté client (D3) : le schéma serveur est `.strict()`.
      expect(
        (await postMotDePasse(api, { actuel: motDePasseCourant, nouveau: mdpNouveau(), confirmation: mdpNouveau() })).status(),
        'clé confirmation interdite',
      ).toBe(HTTP.BAD_REQUEST)
    } finally {
      await api.dispose()
    }
  })

  test('changement complet : 200, session conservée, ancien mdp 401 au login, nouveau 200', async ({}, testInfo) => {
    const compte = compteE2E()
    const ancien = motDePasseCourant
    const nouveau = mdpNouveau()

    const api = await apiAs(testInfo, compte)
    try {
      const ok = await postMotDePasse(api, { actuel: ancien, nouveau })
      expect(ok.status()).toBe(HTTP.OK)
      expect(await ok.json()).toEqual({ ok: true })
      // D4 : aucune session invalidée — le changement ne touche ni `user` ni `secure`.
      expect((await api.get(ROUTE_PROFIL)).status(), 'session courante intacte').toBe(HTTP.OK)
    } finally {
      await api.dispose()
    }

    const anon = await pwRequest.newContext({ baseURL: baseURL(testInfo) })
    try {
      const vieux = await anon.post(ROUTE_LOGIN, {
        headers: { 'x-forwarded-for': nextTestIp() },
        data: { email: compte.email, password: ancien },
      })
      expect(vieux.status(), 'ancien mot de passe rejeté').toBe(HTTP.UNAUTHORIZED)
      const frais = await anon.post(ROUTE_LOGIN, {
        headers: { 'x-forwarded-for': nextTestIp() },
        data: { email: compte.email, password: nouveau },
      })
      expect(frais.status(), 'nouveau mot de passe accepté').toBe(HTTP.OK)
    } finally {
      await anon.dispose()
    }

    motDePasseCourant = nouveau
  })

  test('413 : corps > 4 Ko rejeté avant lecture', async ({}, testInfo) => {
    const api = await apiAs(testInfo, compteE2E())
    try {
      const res = await postMotDePasse(api, { actuel: 'a'.repeat(5_000), nouveau: 'b'.repeat(5_000) })
      expect(res.status()).toBe(HTTP.PAYLOAD_TOO_LARGE)
    } finally {
      await api.dispose()
    }
  })

  test('429 : 6 POST « actuel faux » depuis la même IP → 400 ×5 puis 429 + Retry-After', async ({}, testInfo) => {
    const api = await apiAs(testInfo, compteE2E())
    const corps = { actuel: MDP_ACTUEL_FAUX, nouveau: mdpNouveau() }
    try {
      let statuts: number[] = []
      let dernieresEntetes: Record<string, string> = {}
      // Contrairement au helper résilient, ce test A BESOIN d'une IP vierge (0 hit) : la
      // première tentative frappe le suffixe hors pool (jamais tiré par nextTestIp) ; si ce
      // suffixe porte l'état d'un run récent, la salve est reprise sur une IP du pool
      // (ipEntamee → nouvelle tentative).
      for (let tentative = 0; tentative < MAX_IP_RETRIES; tentative++) {
        const ip = tentative === 0 ? IP_QUOTA_HORS_POOL : nextTestIp()
        statuts = []
        let ipEntamee = false
        for (let i = 0; i < NOMBRE_REQUETES_QUOTA; i++) {
          const res = await api.post(ROUTE_MDP, { headers: { 'x-forwarded-for': ip }, data: corps })
          statuts.push(res.status())
          dernieresEntetes = res.headers()
          if (i < NOMBRE_REQUETES_QUOTA - 1 && res.status() === HTTP.TOO_MANY_REQUESTS) {
            ipEntamee = true
            break
          }
        }
        if (!ipEntamee) break
      }
      expect(statuts).toEqual([HTTP.BAD_REQUEST, HTTP.BAD_REQUEST, HTTP.BAD_REQUEST, HTTP.BAD_REQUEST, HTTP.BAD_REQUEST, HTTP.TOO_MANY_REQUESTS])
      expect(dernieresEntetes['retry-after'], 'Retry-After numérique').toMatch(/^\d+$/)
    } finally {
      await api.dispose()
    }
  })
})

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------
test.describe('UI /admin/parametres', () => {
  /**
   * Sonde une IP du pool avant de la confier à la page : le POST du dialog part du `fetch` du
   * navigateur, impossible de rejouer avec une autre IP si le quota résiduel d'un run
   * précédent la sature. 1 POST « actuel faux » (400 attendu, pas d'écriture) = 1 hit du
   * budget 5 — les tests UI n'en consomment qu'un autre chacun.
   */
  async function ipUiVierge(context: BrowserContext): Promise<string> {
    for (let attempt = 0; attempt < MAX_IP_RETRIES; attempt++) {
      const ip = nextTestIp()
      // eslint-disable-next-line no-await-in-loop
      const probe = await context.request.post(ROUTE_MDP, {
        headers: { 'x-forwarded-for': ip },
        data: { actuel: MDP_ACTUEL_FAUX, nouveau: mdpNouveau() },
      })
      if (probe.status() !== HTTP.TOO_MANY_REQUESTS) return ip
    }
    throw new Error(`Aucune IP UI vierge (scope profil-mot-de-passe) après ${MAX_IP_RETRIES} tentatives.`)
  }

  async function ouvrirParametres(page: Page, context: BrowserContext, compte: AdminAccount): Promise<void> {
    // Connexion d'abord (sans header IP : `loginAs` passe par `context.request`, son bucket
    // `login` est distinct et un login réussi le remet à zéro), puis IP sondée pour TOUTES
    // les requêtes de la page.
    await loginAs(context, compte)
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': await ipUiVierge(context) })
    await page.goto('/admin/parametres')
    await expect(page.getByRole('heading', { level: 1, name: 'Paramètres' })).toBeVisible()
    await expect(page.getByText('Consultez votre compte et modifiez votre mot de passe.', { exact: true })).toBeVisible()
  }

  /** Nom / Courriel / Rôle (badge libellé exact via ROLE_LABELS) / Filiale rattachée. */
  async function verifierProfil(page: Page, profil: AdminProfilDto): Promise<void> {
    const main = page.getByRole('main')
    await expect(main.getByText('Nom', { exact: true })).toBeVisible()
    await expect(main.getByText(profil.nom, { exact: true })).toBeVisible()
    await expect(main.getByText('Courriel', { exact: true })).toBeVisible()
    await expect(main.getByText(profil.email, { exact: true })).toBeVisible()
    await expect(main.getByText('Rôle', { exact: true })).toBeVisible()
    const badge = main.locator('[data-slot="badge"]').filter({ hasText: ROLE_LABELS[profil.role] })
    await expect(badge).toHaveText(ROLE_LABELS[profil.role])
    await expect(main.getByText('Filiale rattachée', { exact: true })).toBeVisible()
    if (profil.company === null) {
      await expect(main.getByText(FILIALE_HORS_ENTREPRISE, { exact: true })).toBeVisible()
    } else {
      await expect(main.getByText(profil.company.nom, { exact: true })).toBeVisible()
    }
  }

  /** Ouvre le dialog de changement de mdp et en vérifie l'en-tête. */
  async function ouvrirDialog(page: Page): Promise<Locator> {
    await page.getByRole('button', { name: 'Changer le mot de passe' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Changer le mot de passe' })).toBeVisible()
    await expect(dialog.getByText('Saisissez votre mot de passe actuel pour confirmer le changement.', { exact: true })).toBeVisible()
    return dialog
  }

  /** Message d'erreur SOUS un champ du dialog : le formulaire peut en afficher plusieurs à la fois
   * (ex. « nouveau » court ET confirmation vide), d'où le ciblage par `id` d'input plutôt que
   * `getByRole('alert')` sur tout le dialog (strict mode). */
  function alertSous(dialog: Locator, idChamp: 'mdp-actuel' | 'mdp-nouveau' | 'mdp-confirmation'): Locator {
    return dialog.locator(`div.space-y-2:has(#${idChamp})`).getByRole('alert')
  }

  async function remplirDialog(dialog: Locator, valeurs: { actuel: string; nouveau: string }): Promise<void> {
    await dialog.getByLabel('Mot de passe actuel', { exact: true }).fill(valeurs.actuel)
    await dialog.getByLabel('Nouveau mot de passe', { exact: true }).fill(valeurs.nouveau)
    await dialog.getByLabel('Confirmer le nouveau mot de passe', { exact: true }).fill(valeurs.nouveau)
  }

  /** Compteur de POST vers le endpoint de changement (preuve d'absence d'appel réseau). */
  function suivrePostsMotDePasse(page: Page): string[] {
    const appels: string[] = []
    page.on('request', (req) => {
      if (req.method() === 'POST' && new URL(req.url()).pathname === ROUTE_MDP) appels.push(req.url())
    })
    return appels
  }

  test('SUPER_ADMIN : company null, « Aucune (accès groupe entier) », lien « Paramètres » en nav', async ({ page, context }) => {
    await ouvrirParametres(page, context, SUPER_ADMIN)
    const profil = await profilDe(context.request)
    expect(profil.company).toBeNull()
    expect(profil.role).toBe(ROLES.SUPER_ADMIN)
    await verifierProfil(page, profil)

    const shell = new AdminShell(page)
    await shell.ouvrirNavigation()
    await expect(shell.navigation.getByRole('link', { name: 'Paramètres', exact: true })).toBeVisible()
  })

  test('ADMIN_FILIALE entretien : company.nom affiché, badge et lien « Paramètres » en nav', async ({ page, context }) => {
    await ouvrirParametres(page, context, ADMIN_FILIALE_ENTRETIEN)
    const profil = await profilDe(context.request)
    expect(profil.company?.nom.length ?? 0).toBeGreaterThan(0)
    expect(profil.role).toBe(ROLES.ADMIN_FILIALE)
    await verifierProfil(page, profil)

    const shell = new AdminShell(page)
    await shell.ouvrirNavigation()
    await expect(shell.navigation.getByRole('link', { name: 'Paramètres', exact: true })).toBeVisible()
  })

  test('EMPLOYE : accès à la page, badge et lien « Paramètres » en nav', async ({ page, context }) => {
    await ouvrirParametres(page, context, EMPLOYE_ENTRETIEN)
    const profil = await profilDe(context.request)
    expect(profil.role).toBe(ROLES.EMPLOYE)
    await verifierProfil(page, profil)

    const shell = new AdminShell(page)
    await shell.ouvrirNavigation()
    await expect(shell.navigation.getByRole('link', { name: 'Paramètres', exact: true })).toBeVisible()
  })

  test('dialog : validation cliente (nouveau court, confirmation différente) sans requête réseau', async ({ page, context }) => {
    await ouvrirParametres(page, context, compteE2E())
    const appels = suivrePostsMotDePasse(page)
    const dialog = await ouvrirDialog(page)

    await remplirDialog(dialog, { actuel: motDePasseCourant, nouveau: MDP_COURT })
    await dialog.getByRole('button', { name: 'Enregistrer' }).click()
    // Les deux champs saisis sont trop courts : chacun porte son propre message.
    await expect(alertSous(dialog, 'mdp-nouveau')).toHaveText(ERREUR_LONGUEUR)
    await expect(alertSous(dialog, 'mdp-confirmation')).toHaveText(ERREUR_LONGUEUR)

    // Confirmation laissée vide : message dédié, pas une répétition de la règle de longueur.
    await dialog.getByLabel('Confirmer le nouveau mot de passe', { exact: true }).fill('')
    await dialog.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(alertSous(dialog, 'mdp-confirmation')).toHaveText(ERREUR_CONFIRMATION_VIDE)
    await expect(alertSous(dialog, 'mdp-nouveau')).toHaveText(ERREUR_LONGUEUR)

    const nouveau = mdpNouveau()
    await remplirDialog(dialog, { actuel: motDePasseCourant, nouveau })
    await dialog.getByLabel('Confirmer le nouveau mot de passe', { exact: true }).fill(`${nouveau}-x`)
    await dialog.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(alertSous(dialog, 'mdp-confirmation')).toHaveText(ERREUR_CONFIRMATION)

    await expect(dialog).toBeVisible()
    expect(appels, 'aucune requête POST ne doit partir sur un formulaire invalide').toHaveLength(0)
  })

  test('dialog : mot de passe actuel faux → erreur sous le champ, dialog ouvert', async ({ page, context }) => {
    await ouvrirParametres(page, context, compteE2E())
    const appels = suivrePostsMotDePasse(page)
    const dialog = await ouvrirDialog(page)

    await remplirDialog(dialog, { actuel: MDP_ACTUEL_FAUX, nouveau: mdpNouveau() })
    await dialog.getByRole('button', { name: 'Enregistrer' }).click()

    // 400 et jamais 401 (D5) : le message serveur apparaît sous le champ, sans déconnexion.
    await expect(alertSous(dialog, 'mdp-actuel')).toHaveText(MESSAGE_ACTUEL_INCORRECT)
    await expect(dialog).toBeVisible()
    await expect(page).toHaveURL(/\/admin\/parametres/)
    expect(appels).toHaveLength(1)
  })

  test('dialog : changement réussi → toast exact, dialog fermé, toujours connecté', async ({ page, context }) => {
    await ouvrirParametres(page, context, compteE2E())
    const dialog = await ouvrirDialog(page)
    const nouveau = mdpNouveau()

    await remplirDialog(dialog, { actuel: motDePasseCourant, nouveau })
    await dialog.getByRole('button', { name: 'Enregistrer' }).click()

    await expect(page.getByText(TOAST_SUCCES, { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1, name: 'Paramètres' })).toBeVisible()
    expect((await context.request.get(ROUTE_PROFIL)).status(), 'session toujours valide').toBe(HTTP.OK)

    motDePasseCourant = nouveau
  })

  test('mobile : page et dialog sans défilement horizontal, cibles ≥ 44 px', async ({ page, context }) => {
    test.skip(!estMobile(page), 'critère 375 px (projet mobile)')
    await ouvrirParametres(page, context, compteE2E())

    const sansScrollHorizontal = async (): Promise<void> => {
      const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
      expect(sw).toBeLessThanOrEqual(cw + 1)
    }
    await sansScrollHorizontal()

    const boutonMdp = page.getByRole('button', { name: 'Changer le mot de passe' })
    const boite = await boutonMdp.boundingBox()
    expect(boite, 'bouton « Changer le mot de passe » mesurable').toBeTruthy()
    expect(boite!.height).toBeGreaterThanOrEqual(44)
    expect(boite!.width).toBeGreaterThanOrEqual(44)

    await boutonMdp.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Changer le mot de passe' })).toBeVisible()
    await sansScrollHorizontal()

    for (const nom of ['Annuler', 'Enregistrer'] as const) {
      const bouton = dialog.getByRole('button', { name: nom, exact: true })
      const cible = await bouton.boundingBox()
      expect(cible, `bouton ${nom} mesurable`).toBeTruthy()
      expect(cible!.height, `bouton ${nom} : hauteur`).toBeGreaterThanOrEqual(44)
    }
    const bascules = dialog.getByRole('button', { name: /Afficher le mot de passe|Masquer le mot de passe/ })
    await expect(bascules).toHaveCount(3)
    for (let i = 0; i < 3; i++) {
      const cible = await bascules.nth(i).boundingBox()
      expect(cible, `bascule ${i} mesurable`).toBeTruthy()
      expect(cible!.height, `bascule ${i} : hauteur`).toBeGreaterThanOrEqual(44)
      expect(cible!.width, `bascule ${i} : largeur`).toBeGreaterThanOrEqual(44)
    }
  })
})
