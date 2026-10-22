// Lot 5 — /admin/comptable/dossiers (docs/specs/lot5-dossiers-comptables.md §6).
// Tous les dossiers créés ont un courriel `…-<marqueur>@example.test` ; purge en afterAll
// (clients supprimés, dossiers en cascade). Marqueur régénéré par projet (desktop, mobile).
import { test, expect, request as pwRequest, type TestInfo } from '@playwright/test'
import type { AdminDossierComptableDto, AdminDossiersPageDto } from '#shared/types/admin'
import { loginAs, SUPER_ADMIN, ADMIN_FILIALE_ENTRETIEN, ADMIN_FILIALE_CDPAA, EMPLOYE_ENTRETIEN } from './helpers/auth'
import { apiAs, clesInterdites, AdminShell } from './fixtures/admin-pages'
import { emailTest, nouveauMarqueur, purgerDonneesAdmin } from './fixtures/admin-data'

const HTTP = { OK: 200, CREATED: 201, NO_CONTENT: 204, BAD_REQUEST: 400, FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409 } as const

const ROUTES = ['/api/admin/comptable/dossiers', '/api/admin/comptable/dossiers/x'] as const

let marqueur = ''

function baseURL(testInfo: TestInfo): string {
  return (testInfo.project.use.baseURL as string | undefined) || 'http://localhost:3200'
}

function corpsDossier(marqueurLocal: string, suffixe: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    entreprise: `Entreprise ${suffixe} ${marqueurLocal}`,
    contact: `Contact ${suffixe}`,
    email: emailTest(`dossier-${suffixe}`, marqueurLocal),
    forfait: 'MENSUEL',
    echeance: '2027-03-01',
    ...extra,
  }
}

test.beforeAll(() => {
  marqueur = nouveauMarqueur('d')
})

test.afterAll(() => {
  purgerDonneesAdmin(marqueur)
})

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
test.describe('API /api/admin/comptable/dossiers', () => {
  test('requires a session on all four routes (401)', async ({}, testInfo) => {
    const anon = await pwRequest.newContext({ baseURL: baseURL(testInfo) })
    try {
      expect((await anon.get(ROUTES[0])).status(), 'GET').toBe(401)
      expect((await anon.post(ROUTES[0], { data: {} })).status(), 'POST').toBe(401)
      expect((await anon.patch(ROUTES[1], { data: {} })).status(), 'PATCH').toBe(401)
      expect((await anon.delete(ROUTES[1])).status(), 'DELETE').toBe(401)
    } finally {
      await anon.dispose()
    }
  })

  test('forbids EMPLOYE and an AF without the comptable module (403)', async ({}, testInfo) => {
    const emp = await apiAs(testInfo, EMPLOYE_ENTRETIEN)
    const afEtranger = await apiAs(testInfo, ADMIN_FILIALE_CDPAA)
    try {
      expect((await emp.get(ROUTES[0])).status(), 'EMPLOYE').toBe(HTTP.FORBIDDEN)
      expect((await afEtranger.get(ROUTES[0])).status(), 'AF sans le module').toBe(HTTP.FORBIDDEN)
      expect((await afEtranger.post(ROUTES[0], { data: corpsDossier(marqueur, 'intrus') })).status()).toBe(HTTP.FORBIDDEN)
    } finally {
      await emp.dispose()
      await afEtranger.dispose()
    }
  })

  test('lists dossiers: no-store, uuid only, deadline ascending, global enRetard counter', async ({}, testInfo) => {
    const sa = await apiAs(testInfo, SUPER_ADMIN)
    try {
      const creeA = await sa.post(ROUTES[0], { data: corpsDossier(marqueur, 'tri-a', { echeance: '2027-06-15', statut: 'EN_RETARD' }) })
      const creeB = await sa.post(ROUTES[0], { data: corpsDossier(marqueur, 'tri-b', { echeance: '2027-01-10' }) })
      expect(creeA.status()).toBe(HTTP.CREATED)
      expect(creeB.status()).toBe(HTTP.CREATED)
      const dossierA = (await creeA.json()) as AdminDossierComptableDto
      const dossierB = (await creeB.json()) as AdminDossierComptableDto

      const liste = await sa.get(ROUTES[0])
      expect(liste.status()).toBe(HTTP.OK)
      expect(liste.headers()['cache-control']).toContain('no-store')
      const page = (await liste.json()) as AdminDossiersPageDto
      expect(page.items.length).toBeGreaterThan(0)
      expect(typeof page.enRetard).toBe('number')
      expect(page.enRetard).toBeGreaterThan(0)
      expect(clesInterdites(page)).toEqual([])
      expect(page.items.every((d) => typeof d.echeance === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.echeance))).toBe(true)

      // Tri échéance croissante sur l'ensemble de la page.
      const echeances = page.items.map((d) => d.echeance)
      expect(echeances).toEqual([...echeances].sort())
      const posB = page.items.findIndex((d) => d.uuid === dossierB.uuid)
      const posA = page.items.findIndex((d) => d.uuid === dossierA.uuid)
      expect(posB).toBeGreaterThanOrEqual(0)
      expect(posA).toBeGreaterThan(posB)

      // Filtre statut : seuls les EN_RETARD, mais enRetard reste le compteur global.
      const filtre = (await (await sa.get(`${ROUTES[0]}?statut=EN_RETARD`)).json()) as AdminDossiersPageDto
      expect(filtre.items.every((d) => d.statut === 'EN_RETARD')).toBe(true)
      expect(filtre.enRetard).toBe(page.enRetard)

      expect((await sa.get(`${ROUTES[0]}?statut=NOPE`)).status(), 'statut invalide').toBe(HTTP.BAD_REQUEST)
      expect((await sa.get(`${ROUTES[0]}?page=0`)).status(), 'page invalide').toBe(HTTP.BAD_REQUEST)
      expect((await sa.get(`${ROUTES[0]}?inconnu=x`)).status(), 'clé inconnue').toBe(HTTP.BAD_REQUEST)
    } finally {
      await sa.dispose()
    }
  })

  test('creates client + dossier in one transaction, rejects invalid input and duplicate email', async ({}, testInfo) => {
    const sa = await apiAs(testInfo, SUPER_ADMIN)
    try {
      const corps = corpsDossier(marqueur, 'create', { email: `  CREATION-${marqueur}@Example.test `, statut: 'EN_TRAITEMENT' })
      const cree = await sa.post(ROUTES[0], { data: corps })
      expect(cree.status()).toBe(HTTP.CREATED)
      const dossier = (await cree.json()) as AdminDossierComptableDto
      expect(dossier.email).toBe(`creation-${marqueur}@example.test`)
      expect(dossier.statut).toBe('EN_TRAITEMENT')
      expect(dossier.forfait).toBe('MENSUEL')
      expect(clesInterdites(dossier)).toEqual([])

      // Le Client est créé en CLIENT_ACTIF avec le dossier (relation 1-1).
      const clients = (await (
        await sa.get(`/api/admin/clients?site=comptable&q=${encodeURIComponent(dossier.email)}`)
      ).json()) as { items: readonly { uuid: string; nom: string; statut: string; aDossier: boolean }[] }
      expect(clients.items).toHaveLength(1)
      expect(clients.items[0]!.nom).toBe('Contact create')
      expect(clients.items[0]!.statut).toBe('CLIENT_ACTIF')
      expect(clients.items[0]!.aDossier).toBe(true)

      expect((await sa.post(ROUTES[0], { data: corps })).status(), 'doublon de courriel').toBe(HTTP.CONFLICT)
      const doublon = await sa.post(ROUTES[0], { data: corpsDossier(marqueur, 'doublon', { email: `creation-${marqueur}@example.test` }) })
      expect(doublon.status(), 'doublon casse différente').toBe(HTTP.CONFLICT)
      expect(((await doublon.json()) as { statusMessage: string }).statusMessage).toBe('Ce courriel existe déjà pour cette filiale.')

      const base = corpsDossier(marqueur, 'invalid')
      expect((await sa.post(ROUTES[0], { data: { ...base, email: 'pas-un-courriel' } })).status(), 'email').toBe(HTTP.BAD_REQUEST)
      expect((await sa.post(ROUTES[0], { data: { ...base, echeance: '2027-02-30' } })).status(), 'date calendaire').toBe(HTTP.BAD_REQUEST)
      expect((await sa.post(ROUTES[0], { data: { ...base, echeance: '01-03-2027' } })).status(), 'format date').toBe(HTTP.BAD_REQUEST)
      expect((await sa.post(ROUTES[0], { data: { ...base, forfait: 'HEBDO' } })).status(), 'forfait').toBe(HTTP.BAD_REQUEST)
      expect((await sa.post(ROUTES[0], { data: { ...base, entreprise: '' } })).status(), 'entreprise vide').toBe(HTTP.BAD_REQUEST)
      expect((await sa.post(ROUTES[0], { data: { ...base, documentsKeys: [] } })).status(), 'clé inconnue').toBe(HTTP.BAD_REQUEST)
      expect((await sa.post(ROUTES[0], { data: {} })).status(), 'corps vide').toBe(HTTP.BAD_REQUEST)
    } finally {
      await sa.dispose()
    }
  })

  test('patches dossier + linked client fields, 404 unknown uuid, 409 foreign email, 400 empty', async ({}, testInfo) => {
    const sa = await apiAs(testInfo, SUPER_ADMIN)
    try {
      const cible = (await (
        await sa.post(ROUTES[0], { data: corpsDossier(marqueur, 'patch') })
      ).json()) as AdminDossierComptableDto
      const autre = (await (
        await sa.post(ROUTES[0], { data: corpsDossier(marqueur, 'patch-autre') })
      ).json()) as AdminDossierComptableDto

      expect((await sa.patch(`/api/admin/comptable/dossiers/${cible.uuid}`, { data: {} })).status(), 'PATCH {}').toBe(HTTP.BAD_REQUEST)
      expect((await sa.patch(`/api/admin/comptable/dossiers/${cible.uuid}`, { data: { companyId: 1 } })).status(), 'clé inconnue').toBe(HTTP.BAD_REQUEST)
      expect((await sa.patch('/api/admin/comptable/dossiers/pas-un-uuid', { data: { statut: 'A_JOUR' } })).status(), 'uuid malformé').toBe(HTTP.BAD_REQUEST)
      expect(
        (await sa.patch('/api/admin/comptable/dossiers/00000000-0000-4000-8000-000000000000', { data: { statut: 'A_JOUR' } })).status(),
        'uuid inconnu',
      ).toBe(HTTP.NOT_FOUND)
      expect((await sa.patch(`/api/admin/comptable/dossiers/${cible.uuid}`, { data: { email: autre.email } })).status(), 'email d’un autre').toBe(HTTP.CONFLICT)

      const maj = await sa.patch(`/api/admin/comptable/dossiers/${cible.uuid}`, {
        data: { contact: 'Contact Patché', statut: 'EN_RETARD', notes: '' },
      })
      expect(maj.status()).toBe(HTTP.OK)
      const patche = (await maj.json()) as AdminDossierComptableDto
      expect(patche.contact).toBe('Contact Patché')
      expect(patche.statut).toBe('EN_RETARD')
      expect(patche.notes).toBeNull()

      // Le Client lié est mis à jour avec le contact.
      const clients = (await (
        await sa.get(`/api/admin/clients?site=comptable&q=${encodeURIComponent(cible.email)}`)
      ).json()) as { items: readonly { nom: string }[] }
      expect(clients.items[0]!.nom).toBe('Contact Patché')
    } finally {
      await sa.dispose()
    }
  })

  test('deletes the dossier only (204): gone from the list, the CRM client survives', async ({}, testInfo) => {
    const sa = await apiAs(testInfo, SUPER_ADMIN)
    try {
      const dossier = (await (
        await sa.post(ROUTES[0], { data: corpsDossier(marqueur, 'delete') })
      ).json()) as AdminDossierComptableDto

      expect((await sa.delete(`/api/admin/comptable/dossiers/${dossier.uuid}`)).status()).toBe(HTTP.NO_CONTENT)
      expect((await sa.delete(`/api/admin/comptable/dossiers/${dossier.uuid}`)).status(), 'déjà supprimé').toBe(HTTP.NOT_FOUND)

      const apres = (await (await sa.get(ROUTES[0])).json()) as AdminDossiersPageDto
      expect(apres.items.some((d) => d.uuid === dossier.uuid)).toBe(false)

      // Le Client reste dans le carnet CRM, sans dossier.
      const clients = (await (
        await sa.get(`/api/admin/clients?site=comptable&q=${encodeURIComponent(dossier.email)}`)
      ).json()) as { items: readonly { nom: string; aDossier: boolean }[] }
      expect(clients.items).toHaveLength(1)
      expect(clients.items[0]!.aDossier).toBe(false)
    } finally {
      await sa.dispose()
    }
  })
})

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------
test.describe('UI /admin/comptable/dossiers', () => {
  test.beforeEach(async ({ context }) => {
    await loginAs(context, SUPER_ADMIN)
  })

  test('creates a dossier through the dialog (field errors first), then rejects a duplicate inline', async ({ page }) => {
    await page.goto('/admin/comptable/dossiers')
    await expect(page.getByRole('heading', { name: 'Dossiers clients' })).toBeVisible()
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Nouveau dossier' })).toBeVisible()

    // Soumission vide : erreurs sous les champs, aucune requête de création.
    const creations: string[] = []
    page.on('request', (req) => {
      if (req.method() === 'POST' && new URL(req.url()).pathname === '/api/admin/comptable/dossiers') creations.push(req.url())
    })
    await dialog.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(dialog.getByRole('alert').first()).toBeVisible()
    expect(creations).toHaveLength(0)

    const courriel = emailTest('ui-cree', marqueur)
    await dialog.getByLabel(/^Entreprise/).fill('Entreprise UI E2E')
    await dialog.getByLabel(/^Contact/).fill('Contact UI')
    await dialog.getByLabel(/^Courriel/).fill(courriel)
    await dialog.getByLabel('Prochaine échéance').fill('2027-05-15')
    await dialog.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByText('Dossier ajouté.', { exact: true })).toBeVisible()
    await expect(dialog).toBeHidden()

    const ligne = page.getByRole('listitem').filter({ hasText: courriel })
    await expect(ligne).toHaveCount(1)
    await expect(ligne).toContainText('Entreprise UI E2E')
    await expect(ligne).toContainText('À jour')
    await expect(ligne).toContainText('15 mai 2027')

    // Doublon : 409 sous le champ Courriel, dialog ouvert.
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click()
    await dialog.getByLabel(/^Entreprise/).fill('Doublon UI')
    await dialog.getByLabel(/^Contact/).fill('Contact Doublon')
    await dialog.getByLabel(/^Courriel/).fill(courriel.toUpperCase().replace('@EXAMPLE.TEST', '@Example.test'))
    await dialog.getByLabel('Prochaine échéance').fill('2027-06-01')
    await dialog.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(dialog.getByRole('alert').filter({ hasText: 'Ce courriel existe déjà pour cette filiale.' })).toBeVisible()
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Annuler' }).click()
    await expect(dialog).toBeHidden()
  })

  test('edits a dossier (toast, list updated) and deletes it via the confirm dialog', async ({ page, context }) => {
    const courriel = emailTest('ui-edit', marqueur)
    // La session du beforeEach (SUPER_ADMIN) s'applique aussi à context.request.
    const cree = await context.request.post(ROUTES[0], { data: corpsDossier(marqueur, 'ui-edit', { email: courriel, statut: 'EN_TRAITEMENT' }) })
    expect(cree.status()).toBe(HTTP.CREATED)

    await page.goto(`/admin/comptable/dossiers?statut=EN_TRAITEMENT`)
    const ligne = page.getByRole('listitem').filter({ hasText: courriel })
    await expect(ligne).toHaveCount(1)

    await ligne.getByRole('button', { name: /Modifier/ }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Modifier le dossier' })).toBeVisible()
    await dialog.getByLabel(/^Notes/).fill('Relance faite.')
    await dialog.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByText('Dossier mis à jour.', { exact: true })).toBeVisible()
    await expect(ligne).toContainText('Relance faite.')

    await ligne.getByRole('button', { name: /Supprimer/ }).click()
    const alert = page.getByRole('alertdialog')
    await expect(alert.getByText('Supprimer ce dossier ?')).toBeVisible()
    await expect(alert).toContainText('Cette action est définitive.')
    await alert.getByRole('button', { name: 'Annuler' }).click()
    await expect(alert).toBeHidden()
    await expect(ligne).toHaveCount(1)

    await ligne.getByRole('button', { name: /Supprimer/ }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Supprimer' }).click()
    await expect(page.getByText('Dossier supprimé.', { exact: true })).toBeVisible()
    await expect(ligne).toHaveCount(0)
  })

  test('filters by status (URL-persisted) and paginates beyond one page', async ({ page, context }) => {
    // Assez de dossiers pour dépasser la page 20 (session du beforeEach).
    for (let i = 1; i <= 21; i++) {
      const reponse = await context.request.post(ROUTES[0], {
        data: corpsDossier(marqueur, `page${i}`, { echeance: `2028-01-${String(i).padStart(2, '0')}` }),
      })
      expect(reponse.status(), `création page${i}`).toBe(HTTP.CREATED)
    }

    await page.goto('/admin/comptable/dossiers')
    const pagination = page.getByRole('navigation', { name: 'Pagination' })
    await expect(pagination).toBeVisible()
    await expect(pagination).toContainText('Page 1 /')

    await pagination.getByRole('button', { name: 'Suivant' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(pagination).toContainText('Page 2 /')

    // Filtre statut : URL + seuls les EN_RETARD restent (listitems du contenu, pas de la sidebar).
    await page.goto('/admin/comptable/dossiers')
    await page.getByRole('combobox', { name: 'Statut' }).click()
    await page.getByRole('option', { name: 'En retard', exact: true }).click()
    await expect(page).toHaveURL(/statut=EN_RETARD/)
    const statuts = await page.getByRole('main').getByRole('listitem').evaluateAll((els) =>
      els.map((el) => (el.textContent ?? '').includes('En retard')),
    )
    expect(statuts.length).toBeGreaterThan(0)
    expect(statuts.every(Boolean)).toBe(true)

    await page.reload()
    await expect(page.getByRole('combobox', { name: 'Statut' })).toHaveText('En retard')
  })

  test('shows the comptable nav item to SA, hides it from an AF without the module, stacks rows on mobile', async ({ page, context }) => {
    const shell = new AdminShell(page)
    await page.goto('/admin/comptable/dossiers')
    await shell.ouvrirNavigation()
    await expect(shell.navigation.getByRole('link', { name: 'Dossiers' })).toBeVisible()

    // Redirection de la coquille /admin/comptable.
    await page.goto('/admin/comptable')
    await expect(page).toHaveURL(/\/admin\/comptable\/dossiers/)

    // AF entretien : pas de module comptable -> item masqué, accès direct refusé (403 page/API).
    await context.clearCookies()
    await loginAs(context, ADMIN_FILIALE_ENTRETIEN)
    await page.goto('/admin/comptable/dossiers')
    await shell.ouvrirNavigation()
    await expect(shell.navigation.getByRole('link', { name: 'Dossiers' })).toHaveCount(0)

    // Liste en lignes (jamais de tableau) : chaque dossier est un élément de liste empilé.
    await context.clearCookies()
    await loginAs(context, SUPER_ADMIN)
    await page.goto('/admin/comptable/dossiers')
    await expect(page.getByRole('table')).toHaveCount(0)
    await expect(page.getByRole('listitem').first()).toBeVisible()
  })
})
