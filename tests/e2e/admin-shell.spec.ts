// Lot 4 — shell admin, login, tableau de bord, EMPLOYE (spec docs/specs/lot4-admin-socle.md
// §1, §6 critères 2, 3, 9). Exécuté contre le build de production, desktop + mobile (375 px).
// Ne crée aucune donnée persistante (lecture seule + sessions) : rien à nettoyer.
import { test, expect } from '@playwright/test'
import type { AdminDashboardDto } from '#shared/types/admin'
import { loginAs, SUPER_ADMIN, ADMIN_FILIALE_ENTRETIEN, EMPLOYE_ENTRETIEN } from './helpers/auth'
import { nextTestIp } from './helpers/ip'
import { AdminShell, LoginPage, apiAs, clesInterdites, estMobile } from './fixtures/admin-pages'

const HTTP = { OK: 200, UNAUTHORIZED: 401, FORBIDDEN: 403 } as const
const SITES_ATTENDUS_SA = 7

test.describe('Login /admin/login', () => {
  test('should show an inline accessible error (role=alert) on wrong credentials and stay on the login page', async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': nextTestIp() }) // isole le rate-limit de connexion
    const login = new LoginPage(page)
    await login.goto()
    await login.submit(SUPER_ADMIN.email, 'mot-de-passe-incorrect-e2e')

    await expect(login.erreur('Identifiants invalides. Vérifiez votre courriel et votre mot de passe.')).toBeVisible()
    await expect(page).toHaveURL(/\/admin\/login/)
  })

  test('should show field errors and send no login request when the form is empty', async ({ page }) => {
    const appels: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/api/auth/login')) appels.push(req.url())
    })
    const login = new LoginPage(page)
    await login.goto()
    await page.getByRole('button', { name: 'Se connecter' }).click()

    await expect(page.getByLabel('Courriel')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel('Mot de passe')).toHaveAttribute('aria-invalid', 'true')
    expect(appels).toHaveLength(0)
  })

  test('should ignore an open redirect (?redirect=//evil.example) and land on /admin of the same origin', async ({ page }, testInfo) => {
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': nextTestIp() })
    const login = new LoginPage(page)
    await login.goto('//evil.example/phish')
    await login.submit(SUPER_ADMIN.email, SUPER_ADMIN.password)

    await expect(page).toHaveURL(/\/admin$/)
    const attendu = new URL((testInfo.project.use.baseURL as string | undefined) || 'http://localhost:3200')
    expect(new URL(page.url()).origin).toBe(attendu.origin)
  })

  test('should honour a safe internal redirect (?redirect=/admin/clients) after login', async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': nextTestIp() })
    const login = new LoginPage(page)
    await login.goto('/admin/clients')
    await login.submit(SUPER_ADMIN.email, SUPER_ADMIN.password)

    await expect(page).toHaveURL(/\/admin\/clients$/)
  })

  test('should redirect an already connected user from /admin/login to /admin (and to a safe ?redirect)', async ({ page, context }) => {
    await loginAs(context, SUPER_ADMIN)
    const login = new LoginPage(page)

    await login.goto()
    await expect(page).toHaveURL(/\/admin$/)

    await login.goto('/admin/messages')
    await expect(page).toHaveURL(/\/admin\/messages$/)

    await login.goto('//evil.example')
    await expect(page).toHaveURL(/\/admin$/)
  })

  test('should send an anonymous visitor of /admin/messages to the login with the return path', async ({ page }) => {
    await page.goto('/admin/messages')
    await expect(page).toHaveURL(/\/admin\/login\?redirect=(%2F|\/)admin(%2F|\/)messages/)
  })
})

test.describe('Shell admin', () => {
  test('should log out through an AlertDialog (cancel keeps the session) then toast and return to the login', async ({ page, context }) => {
    await loginAs(context, ADMIN_FILIALE_ENTRETIEN)
    const shell = new AdminShell(page)
    await page.goto('/admin')

    await shell.logoutButton.click()
    await expect(shell.logoutDialog.getByText('Se déconnecter ?')).toBeVisible()
    await shell.logoutDialog.getByRole('button', { name: 'Annuler' }).click()
    await expect(shell.logoutDialog).toBeHidden()
    await expect(page).toHaveURL(/\/admin$/)

    await shell.logoutButton.click()
    await shell.logoutDialog.getByRole('button', { name: 'Se déconnecter' }).click()

    await expect(page.getByText('Vous avez été déconnecté.').first()).toBeVisible()
    await expect(page).toHaveURL(/\/admin\/login/)
    const apres = await context.request.get('/api/admin/sites')
    expect(apres.status(), 'la session doit être détruite côté serveur').toBe(HTTP.UNAUTHORIZED)
  })

  test('should render the sidebar in a Sheet under 768 px and inline on desktop', async ({ page, context }) => {
    await loginAs(context, SUPER_ADMIN)
    const shell = new AdminShell(page)
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible()

    if (estMobile(page)) {
      await expect(shell.navigation).toBeHidden()
      await shell.menuTrigger.click()
      await expect(page.getByRole('dialog').getByRole('navigation', { name: 'Navigation de la console' })).toBeVisible()
      await page.getByRole('dialog').getByRole('link', { name: 'Messages' }).click()
      await expect(page).toHaveURL(/\/admin\/messages/)
      await expect(shell.navigation, 'le Sheet doit se fermer après la navigation').toBeHidden()
    } else {
      await expect(shell.navigation).toBeVisible()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await shell.navigation.getByRole('link', { name: 'Clients' }).click()
      await expect(page).toHaveURL(/\/admin\/clients/)
    }
  })

  test('should give the mobile menu button and logout a touch target of at least 44 px (mobile only)', async ({ page, context }) => {
    test.skip(!estMobile(page), 'critère mobile (375 px)')
    await loginAs(context, SUPER_ADMIN)
    const shell = new AdminShell(page)
    await page.goto('/admin')
    const cibles = { 'bouton menu': shell.menuTrigger, 'bouton déconnexion': shell.logoutButton }
    for (const [nom, cible] of Object.entries(cibles)) {
      const box = await cible.boundingBox()
      expect(box, nom).toBeTruthy()
      expect(box!.height, `${nom} : hauteur`).toBeGreaterThanOrEqual(44)
      expect(box!.width, `${nom} : largeur`).toBeGreaterThanOrEqual(44)
    }
  })
})

test.describe('Tableau de bord /admin', () => {
  test('should list the 7 sites for a SUPER_ADMIN, without internal ids (UI and API)', async ({ page, context }) => {
    await loginAs(context, SUPER_ADMIN)
    const api = await context.request.get('/api/admin/dashboard')
    expect(api.status()).toBe(HTTP.OK)
    expect(api.headers()['cache-control']).toContain('no-store')
    const dto = (await api.json()) as AdminDashboardDto
    expect(dto.sites).toHaveLength(SITES_ATTENDUS_SA)
    expect(clesInterdites(dto), 'aucun id/companyId/details brut').toEqual([])

    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Activité par site' })).toBeVisible()
    for (const ligne of dto.sites) await expect(page.getByRole('main').getByText(ligne.site.nom, { exact: true }).filter({ visible: true }).first()).toBeVisible()
  })

  test('should show a single site row to an ADMIN_FILIALE, with company name in the header', async ({ page, context }) => {
    await loginAs(context, ADMIN_FILIALE_ENTRETIEN)
    const dto = (await (await context.request.get('/api/admin/dashboard')).json()) as AdminDashboardDto
    expect(dto.sites).toHaveLength(1)
    expect(dto.sites[0]!.site.slug).toBe('entretien')
    expect(dto.derniersMessages.every((m) => m.site.slug === 'entretien')).toBe(true)

    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Activité par site' })).toBeVisible()
    await expect(page.getByRole('banner').getByText(dto.sites[0]!.site.nom)).toBeVisible()
  })
})

test.describe('EMPLOYE', () => {
  test('should see the empty-module state on /admin and trigger no admin data call', async ({ page, context }) => {
    const appelsDonnees: string[] = []
    page.on('request', (req) => {
      const url = new URL(req.url())
      if (url.pathname.startsWith('/api/admin/')) appelsDonnees.push(`${req.method()} ${url.pathname}`)
    })
    await loginAs(context, EMPLOYE_ENTRETIEN)
    const shell = new AdminShell(page)
    await page.goto('/admin')

    await expect(page.getByText('Aucun module disponible pour votre compte.')).toBeVisible()
    await shell.ouvrirNavigation()
    await expect(shell.navigation.getByRole('link', { name: 'Messages' })).toHaveCount(0)
    await expect(shell.navigation.getByRole('link', { name: 'Clients' })).toHaveCount(0)
    await page.waitForLoadState('networkidle')
    expect(appelsDonnees, 'un EMPLOYE ne doit déclencher aucun appel /api/admin/**').toEqual([])
  })

  test('should redirect an EMPLOYE from /admin/messages and /admin/clients to /admin', async ({ page, context }) => {
    await loginAs(context, EMPLOYE_ENTRETIEN)
    await page.goto('/admin/messages')
    await expect(page).toHaveURL(/\/admin$/)
    await page.goto('/admin/clients')
    await expect(page).toHaveURL(/\/admin$/)
  })

  test('should be refused (403) on every lot-4 API', async ({}, testInfo) => {
    const api = await apiAs(testInfo, EMPLOYE_ENTRETIEN)
    try {
      const uuidInconnu = '00000000-0000-4000-8000-000000000000'
      const statuts = {
        'GET messages': (await api.get('/api/admin/messages')).status(),
        'GET compteurs': (await api.get('/api/admin/messages/compteurs')).status(),
        'PATCH message': (await api.patch(`/api/admin/messages/${uuidInconnu}`, { data: { statut: 'TRAITE' } })).status(),
        'DELETE message': (await api.delete(`/api/admin/messages/${uuidInconnu}`)).status(),
        'POST conversion': (await api.post(`/api/admin/messages/${uuidInconnu}/client`)).status(),
        'GET clients': (await api.get('/api/admin/clients')).status(),
        'POST clients': (await api.post('/api/admin/clients', { data: { nom: 'X', email: 'x@example.test' } })).status(),
        'PATCH client': (await api.patch(`/api/admin/clients/${uuidInconnu}`, { data: { nom: 'X' } })).status(),
        'DELETE client': (await api.delete(`/api/admin/clients/${uuidInconnu}`)).status(),
        'GET dashboard': (await api.get('/api/admin/dashboard')).status(),
      }
      for (const [route, statut] of Object.entries(statuts)) expect(statut, route).toBe(HTTP.FORBIDDEN)
    } finally {
      await api.dispose()
    }
  })
})
