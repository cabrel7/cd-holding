// Lot 4 — /admin/clients (spec docs/specs/lot4-admin-socle.md §6 critères 2, 3, 7).
// Tous les clients créés ont un courriel `…-<marqueur>@example.test` ; purge en afterAll
// (dossiers comptables en cascade). Marqueur régénéré par projet (desktop, mobile).
import { test, expect } from '@playwright/test'
import type { AdminClientDto, AdminPage, AdminSiteSummary } from '#shared/types/admin'
import { loginAs, SUPER_ADMIN, ADMIN_FILIALE_ENTRETIEN } from './helpers/auth'
import { ClientsPage, apiAs, clesInterdites } from './fixtures/admin-pages'
import { emailTest, nouveauMarqueur, purgerDonneesAdmin, semerDossier } from './fixtures/admin-data'

const HTTP = { OK: 200, CREATED: 201, NO_CONTENT: 204, BAD_REQUEST: 400, FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409 } as const

let marqueur = ''

test.beforeAll(() => {
  marqueur = nouveauMarqueur('c')
})

test.afterAll(() => {
  purgerDonneesAdmin(marqueur)
})

test.describe('API /api/admin/clients', () => {
  test('should enforce uniqueness per site, lowercase the email and default to PROSPECT (no internal ids)', async ({}, testInfo) => {
    const sa = await apiAs(testInfo, SUPER_ADMIN)
    try {
      const courriel = emailTest('api-doublon', marqueur)
      const corps = { site: 'entretien', nom: 'Doublon E2E', email: courriel.toUpperCase().replace('@EXAMPLE.TEST', '@Example.test') }

      const cree = await sa.post('/api/admin/clients', { data: corps })
      expect(cree.status()).toBe(HTTP.CREATED)
      expect(cree.headers()['cache-control']).toContain('no-store')
      const client = (await cree.json()) as AdminClientDto
      expect(client.email).toBe(courriel)
      expect(client.statut).toBe('PROSPECT')
      expect(client.site.slug).toBe('entretien')
      expect(client.aDossier).toBe(false)
      expect(clesInterdites(client)).toEqual([])

      // Même filiale (même courriel, casse différente) : 409 générique, jamais 500.
      const doublon = await sa.post('/api/admin/clients', { data: { ...corps, email: courriel } })
      expect(doublon.status()).toBe(HTTP.CONFLICT)
      expect(((await doublon.json()) as { statusMessage: string }).statusMessage).toBe('Ce courriel existe déjà pour cette filiale.')

      // Autre filiale : autorisé.
      const autre = await sa.post('/api/admin/clients', { data: { ...corps, site: 'transport', email: courriel } })
      expect(autre.status()).toBe(HTTP.CREATED)
      expect(((await autre.json()) as AdminClientDto).site.slug).toBe('transport')
    } finally {
      await sa.dispose()
    }
  })

  test('should validate creation input: SA without site 400, unknown key 400, invalid email 400', async ({}, testInfo) => {
    const sa = await apiAs(testInfo, SUPER_ADMIN)
    try {
      const base = { nom: 'Validation E2E', email: emailTest('api-valid', marqueur) }
      expect((await sa.post('/api/admin/clients', { data: base })).status(), 'SA sans site').toBe(HTTP.BAD_REQUEST)
      expect((await sa.post('/api/admin/clients', { data: { ...base, site: 'entretien', companyId: 1 } })).status(), 'clé inconnue').toBe(HTTP.BAD_REQUEST)
      expect((await sa.post('/api/admin/clients', { data: { ...base, site: 'entretien', email: 'pas-un-courriel' } })).status()).toBe(HTTP.BAD_REQUEST)
      expect((await sa.post('/api/admin/clients', { data: { ...base, site: 'entretien', nom: '' } })).status()).toBe(HTTP.BAD_REQUEST)
      expect((await sa.post('/api/admin/clients', { data: { ...base, site: 'inconnu' } })).status()).toBe(HTTP.BAD_REQUEST)
      expect((await sa.get('/api/admin/clients?statut=NOPE')).status()).toBe(HTTP.BAD_REQUEST)
    } finally {
      await sa.dispose()
    }
  })

  test('should scope an ADMIN_FILIALE: own site by default, 403 on a foreign site, 404 on a foreign client, PATCH {} 400', async ({}, testInfo) => {
    const sa = await apiAs(testInfo, SUPER_ADMIN)
    const af = await apiAs(testInfo, ADMIN_FILIALE_ENTRETIEN)
    try {
      const etranger = (await (
        await sa.post('/api/admin/clients', { data: { site: 'transport', nom: 'Étranger E2E', email: emailTest('api-etranger', marqueur) } })
      ).json()) as AdminClientDto
      expect(etranger.site.slug).toBe('transport')

      expect((await af.post('/api/admin/clients', { data: { site: 'transport', nom: 'Intrus', email: emailTest('api-intrus', marqueur) } })).status()).toBe(HTTP.FORBIDDEN)
      expect((await af.get('/api/admin/clients?site=transport')).status()).toBe(HTTP.FORBIDDEN)
      expect((await af.patch(`/api/admin/clients/${etranger.uuid}`, { data: { nom: 'Piraté' } })).status()).toBe(HTTP.NOT_FOUND)
      expect((await af.delete(`/api/admin/clients/${etranger.uuid}`)).status()).toBe(HTTP.NOT_FOUND)

      // Sans `site`, la création d'un AF va dans sa propre filiale.
      const propre = await af.post('/api/admin/clients', { data: { nom: 'Propre E2E', email: emailTest('api-propre', marqueur) } })
      expect(propre.status()).toBe(HTTP.CREATED)
      const monClient = (await propre.json()) as AdminClientDto
      expect(monClient.site.slug).toBe('entretien')

      expect((await af.patch(`/api/admin/clients/${monClient.uuid}`, { data: {} })).status(), 'PATCH {}').toBe(HTTP.BAD_REQUEST)
      expect((await af.patch(`/api/admin/clients/${monClient.uuid}`, { data: { site: 'transport' } })).status(), 'filiale immuable').toBe(HTTP.BAD_REQUEST)
      const maj = await af.patch(`/api/admin/clients/${monClient.uuid}`, { data: { nom: 'Propre modifié', statut: 'CLIENT_ACTIF' } })
      expect(maj.status()).toBe(HTTP.OK)
      expect(await maj.json()).toMatchObject({ nom: 'Propre modifié', statut: 'CLIENT_ACTIF' })
      expect((await af.patch('/api/admin/clients/pas-un-uuid', { data: { nom: 'x' } })).status()).toBe(HTTP.BAD_REQUEST)

      const liste = (await (await af.get(`/api/admin/clients?q=${encodeURIComponent(marqueur)}`)).json()) as AdminPage<AdminClientDto>
      expect(liste.items.every((c) => c.site.slug === 'entretien')).toBe(true)
      expect(liste.items.some((c) => c.uuid === etranger.uuid)).toBe(false)
      expect((await af.delete(`/api/admin/clients/${monClient.uuid}`)).status()).toBe(HTTP.NO_CONTENT)
      expect((await af.delete(`/api/admin/clients/${monClient.uuid}`)).status(), 'déjà supprimé').toBe(HTTP.NOT_FOUND)
    } finally {
      await sa.dispose()
      await af.dispose()
    }
  })
})

test.describe('UI /admin/clients', () => {
  test.beforeEach(async ({ context }) => {
    await loginAs(context, SUPER_ADMIN)
  })

  test('should create a client through the dialog (SA picks the site), then reject a duplicate inline (field error, dialog stays open)', async ({ page, context }) => {
    const sites = (await (await context.request.get('/api/admin/sites')).json()) as AdminSiteSummary[]
    const transport = sites.find((s) => s.slug === 'transport')
    expect(transport, 'la filiale transport doit être seedée').toBeTruthy()
    const libelleTransport = transport!.nomCourt ?? transport!.nom
    const clients = new ClientsPage(page)
    const courriel = emailTest('ui-cree', marqueur)
    await clients.goto()
    await clients.ajouter.click()
    await expect(clients.dialog.getByRole('heading', { name: 'Ajouter un client' })).toBeVisible()

    // Validation : soumission vide -> erreurs sous les champs, aucune requête de création.
    const creations: string[] = []
    page.on('request', (req) => {
      if (req.method() === 'POST' && new URL(req.url()).pathname === '/api/admin/clients') creations.push(req.url())
    })
    await clients.dialog.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(clients.dialog.getByRole('alert').first()).toBeVisible()
    expect(creations).toHaveLength(0)

    await clients.remplir({ site: libelleTransport, nom: 'Client UI E2E', email: courriel, entreprise: 'Entreprise UI' })
    await clients.dialog.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(clients.toast('Client ajouté.')).toBeVisible()
    await expect(clients.dialog).toBeHidden()

    await clients.goto(`?q=${encodeURIComponent(courriel)}`)
    const ligne = clients.ligne(courriel)
    await expect(ligne).toHaveCount(1)
    await expect(ligne).toContainText('Client UI E2E')
    await expect(ligne).toContainText('Prospect')

    // Doublon (même filiale) : le serveur répond 409, le dialog reste ouvert.
    await clients.ajouter.click()
    await clients.remplir({ site: libelleTransport, nom: 'Client UI E2E bis', email: courriel })
    await clients.dialog.getByRole('button', { name: 'Enregistrer' }).click()
    // Le 409 s'affiche sous le champ Courriel (role=alert), le dialog reste ouvert.
    await expect(clients.dialog.getByRole('alert').filter({ hasText: 'Ce courriel existe déjà pour cette filiale.' })).toBeVisible()
    await expect(clients.dialog).toBeVisible()
    await clients.dialog.getByRole('button', { name: 'Annuler' }).click()
    await expect(clients.dialog).toBeHidden()
  })

  test('should edit a client (toast, list updated)', async ({ page }, testInfo) => {
    const sa = await apiAs(testInfo, SUPER_ADMIN)
    try {
      const courriel = emailTest('ui-edit', marqueur)
      await sa.post('/api/admin/clients', { data: { site: 'entretien', nom: 'Avant édition', email: courriel } })
      const clients = new ClientsPage(page)
      await clients.goto(`?q=${encodeURIComponent(courriel)}`)
      await clients.ligne(courriel).getByRole('button', { name: /Modifier/ }).click()

      await expect(clients.dialog.getByRole('heading', { name: 'Modifier le client' })).toBeVisible()
      await expect(clients.dialog.getByRole('combobox', { name: 'Site' }), 'la filiale est immuable').toHaveCount(0)
      await clients.dialog.getByLabel(/^Nom/).fill('Après édition')
      await clients.dialog.getByRole('button', { name: 'Enregistrer' }).click()
      await expect(clients.toast('Client mis à jour.')).toBeVisible()
      await expect(clients.ligne(courriel)).toContainText('Après édition')
    } finally {
      await sa.dispose()
    }
  })

  test('should warn about the cascade on a client with an accounting file, and delete only after confirmation', async ({ page }, testInfo) => {
    const sa = await apiAs(testInfo, SUPER_ADMIN)
    try {
      const courrielDossier = emailTest('ui-dossier', marqueur)
      const courrielSimple = emailTest('ui-simple', marqueur)
      await sa.post('/api/admin/clients', { data: { site: 'comptable', nom: 'Avec dossier', email: courrielDossier } })
      await sa.post('/api/admin/clients', { data: { site: 'entretien', nom: 'Sans dossier', email: courrielSimple } })
      semerDossier(courrielDossier)

      const clients = new ClientsPage(page)
      await clients.goto(`?q=${encodeURIComponent(marqueur)}`)

      // Sans dossier : message générique, Annuler ne supprime pas.
      await clients.ligne(courrielSimple).getByRole('button', { name: /Supprimer/ }).click()
      await expect(clients.alertDialog.getByText('Supprimer ce client ?')).toBeVisible()
      await expect(clients.alertDialog).not.toContainText('dossier comptable')
      await clients.alertDialog.getByRole('button', { name: 'Annuler' }).click()
      await expect(clients.alertDialog).toBeHidden()
      await expect(clients.ligne(courrielSimple)).toHaveCount(1)

      // Avec dossier : l'avertissement de cascade est affiché avant la suppression.
      await clients.ligne(courrielDossier).getByRole('button', { name: /Supprimer/ }).click()
      await expect(clients.alertDialog).toContainText('dossier comptable')
      await clients.alertDialog.getByRole('button', { name: 'Supprimer' }).click()
      await expect(clients.toast('Client supprimé.')).toBeVisible()
      await expect(clients.ligne(courrielDossier)).toHaveCount(0)
      await expect(clients.ligne(courrielSimple)).toHaveCount(1)
    } finally {
      await sa.dispose()
    }
  })

  test('should keep the status and search filters in the URL and restore them on reload', async ({ page }, testInfo) => {
    const sa = await apiAs(testInfo, SUPER_ADMIN)
    try {
      const actif = emailTest('ui-filtre-actif', marqueur)
      const prospect = emailTest('ui-filtre-prospect', marqueur)
      await sa.post('/api/admin/clients', { data: { site: 'entretien', nom: 'Filtre actif', email: actif, statut: 'CLIENT_ACTIF' } })
      await sa.post('/api/admin/clients', { data: { site: 'entretien', nom: 'Filtre prospect', email: prospect } })

      const clients = new ClientsPage(page)
      await clients.goto(`?q=${encodeURIComponent(`ui-filtre`)}`)
      await expect(clients.ligne(actif)).toHaveCount(1)
      await expect(clients.ligne(prospect)).toHaveCount(1)

      await clients.filtres.getByRole('combobox', { name: 'Statut' }).click()
      await page.getByRole('option', { name: 'Actif', exact: true }).click()
      await expect(page).toHaveURL(/statut=CLIENT_ACTIF/)
      await expect(clients.ligne(prospect)).toHaveCount(0)
      await expect(clients.ligne(actif)).toHaveCount(1)

      await page.reload()
      await expect(clients.filtres.getByRole('combobox', { name: 'Statut' })).toHaveText('Actif')
      await expect(clients.filtres.getByLabel('Recherche')).toHaveValue('ui-filtre')
      await expect(clients.ligne(actif)).toHaveCount(1)
      await expect(clients.ligne(prospect)).toHaveCount(0)
    } finally {
      await sa.dispose()
    }
  })

  test('should scope an ADMIN_FILIALE to their site: no site filter, no site field when creating', async ({ page, context }) => {
    await context.clearCookies()
    await loginAs(context, ADMIN_FILIALE_ENTRETIEN)
    const clients = new ClientsPage(page)
    await clients.goto()
    await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible()
    await expect(clients.filtres.getByRole('combobox', { name: 'Site' })).toHaveCount(0)
    await clients.ajouter.click()
    await expect(clients.dialog.getByRole('combobox', { name: 'Site' })).toHaveCount(0)
    await expect(clients.dialog.getByLabel(/^Nom/)).toBeVisible()
  })
})
