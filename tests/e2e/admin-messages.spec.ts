// Lot 4 — /admin/messages (spec docs/specs/lot4-admin-socle.md §6 critères 2, 3, 4, 5, 6, 8).
// Données : 30 messages semés par scripts/cleanup-test-data.ts (25 entretien « Pagination <m> »,
// transport avec details réalistes, holding, suggestion ccdpaa, contact ccdpaa, courriel en casse
// mixte), tous suffixés `-<marqueur>@example.test`, purgés en afterAll (clients convertis inclus).
// Ordre du fichier (1 worker, sans parallélisme) : les tests de mutation (statut, conversion, suppression) passent APRÈS les tests
// qui comptent les 25 messages de pagination.
import { test, expect, type APIRequestContext } from '@playwright/test'
import type { AdminClientDto, AdminMessageDto, AdminPage } from '#shared/types/admin'
import { loginAs, SUPER_ADMIN, ADMIN_FILIALE_ENTRETIEN } from './helpers/auth'
import { AdminShell, MessagesPage, apiAs, clesInterdites } from './fixtures/admin-pages'
import { NOMBRE_MESSAGES_PAGINATION, TAILLE_PAGE, emailTest, nouveauMarqueur, purgerDonneesAdmin, semerMessagesAdmin } from './fixtures/admin-data'

const HTTP = { OK: 200, CREATED: 201, NO_CONTENT: 204, BAD_REQUEST: 400, FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409 } as const
// Marqueur régénéré à chaque projet (desktop, mobile) : les données sont semées puis purgées par projet.
let marqueur = ''
let sujetPagination = ''
let requetePagination = ''

test.beforeAll(() => {
  marqueur = nouveauMarqueur('m')
  sujetPagination = `Pagination ${marqueur}`
  requetePagination = `?q=${encodeURIComponent(sujetPagination)}`
  semerMessagesAdmin(marqueur)
})

test.afterAll(() => {
  purgerDonneesAdmin(marqueur)
})

async function trouverMessage(api: APIRequestContext, courriel: string): Promise<AdminMessageDto> {
  const res = await api.get(`/api/admin/messages?q=${encodeURIComponent(courriel)}`)
  expect(res.status()).toBe(HTTP.OK)
  const page = (await res.json()) as AdminPage<AdminMessageDto>
  const message = page.items.find((m) => m.email.toLowerCase() === courriel.toLowerCase())
  expect(message, `message ${courriel} introuvable`).toBeTruthy()
  return message!
}

test.describe('API /api/admin/messages', () => {
  test('should return a paginated page with no id/companyId/raw details and no-store', async ({}, testInfo) => {
    const api = await apiAs(testInfo, SUPER_ADMIN)
    try {
      const res = await api.get(`/api/admin/messages${requetePagination}`)
      expect(res.status()).toBe(HTTP.OK)
      expect(res.headers()['cache-control']).toContain('no-store')
      const page = (await res.json()) as AdminPage<AdminMessageDto>
      expect(page).toMatchObject({ total: NOMBRE_MESSAGES_PAGINATION, page: 1, pageSize: TAILLE_PAGE, pageCount: 2 })
      expect(page.items).toHaveLength(TAILLE_PAGE)
      expect(clesInterdites(page), 'ni id, ni *Id, ni details brut').toEqual([])
      for (const m of page.items) expect(Object.keys(m.site).sort()).toEqual(['nom', 'slug', 'uuid'])

      const page2 = (await (await api.get(`/api/admin/messages${requetePagination}&page=2`)).json()) as AdminPage<AdminMessageDto>
      expect(page2.items).toHaveLength(NOMBRE_MESSAGES_PAGINATION - TAILLE_PAGE)
      const horsBornes = (await (await api.get(`/api/admin/messages${requetePagination}&page=99`)).json()) as AdminPage<AdminMessageDto>
      expect(horsBornes.items).toEqual([])
      expect(horsBornes.total, 'le vrai total est conservé hors bornes').toBe(NOMBRE_MESSAGES_PAGINATION)

      expect((await api.get('/api/admin/messages?statut=INVALIDE')).status()).toBe(HTTP.BAD_REQUEST)
      expect((await api.get('/api/admin/messages?page=0')).status()).toBe(HTTP.BAD_REQUEST)
      expect((await api.get('/api/admin/messages?inconnu=1')).status(), 'schéma strict').toBe(HTTP.BAD_REQUEST)
    } finally {
      await api.dispose()
    }
  })

  test('should filter by type (suggestions only) and translate details into labelled fields', async ({}, testInfo) => {
    const api = await apiAs(testInfo, SUPER_ADMIN)
    try {
      const sugg = (await (await api.get(`/api/admin/messages?type=SUGGESTION_PRODUIT&q=${encodeURIComponent(marqueur)}`)).json()) as AdminPage<AdminMessageDto>
      expect(sugg.total).toBe(1)
      expect(sugg.items[0]!.formulaire).toBe('suggestion')

      const transport = await trouverMessage(api, emailTest('transport', marqueur))
      expect(transport.formulaire).toBe('transport')
      expect(transport.champs).toContainEqual({ libelle: 'Type de transport', valeur: 'Déménagement commercial' })
      expect(transport.champs).toContainEqual({ libelle: 'Date souhaitée', valeur: '12 novembre 2026' })
    } finally {
      await api.dispose()
    }
  })

  test('should scope an ADMIN_FILIALE: 403 on a foreign ?site, 404 on PATCH/DELETE/convert of a foreign message', async ({}, testInfo) => {
    const sa = await apiAs(testInfo, SUPER_ADMIN)
    const af = await apiAs(testInfo, ADMIN_FILIALE_ENTRETIEN)
    try {
      const etranger = await trouverMessage(sa, emailTest('ccdpaa', marqueur))
      expect(etranger.site.slug).toBe('ccdpaa')

      expect((await af.get('/api/admin/messages?site=ccdpaa')).status()).toBe(HTTP.FORBIDDEN)
      expect((await af.get('/api/admin/clients?site=ccdpaa')).status()).toBe(HTTP.FORBIDDEN)
      expect((await af.patch(`/api/admin/messages/${etranger.uuid}`, { data: { statut: 'TRAITE' } })).status()).toBe(HTTP.NOT_FOUND)
      expect((await af.post(`/api/admin/messages/${etranger.uuid}/client`)).status()).toBe(HTTP.NOT_FOUND)
      expect((await af.delete(`/api/admin/messages/${etranger.uuid}`)).status()).toBe(HTTP.NOT_FOUND)

      const encore = await trouverMessage(sa, emailTest('ccdpaa', marqueur))
      expect(encore.statut, 'le message étranger ne doit pas avoir changé').toBe('NOUVEAU')

      // Liste sans filtre : uniquement sa filiale, et jamais le message ccdpaa semé.
      const liste = (await (await af.get(`/api/admin/messages?q=${encodeURIComponent(marqueur)}`)).json()) as AdminPage<AdminMessageDto>
      expect(liste.total).toBeGreaterThan(0)
      expect(liste.items.every((m) => m.site.slug === 'entretien')).toBe(true)
      expect(liste.items.some((m) => m.email === emailTest('ccdpaa', marqueur))).toBe(false)
      const compteurs = await af.get('/api/admin/messages/compteurs')
      expect(compteurs.status()).toBe(HTTP.OK)
      expect(Object.keys(await compteurs.json())).toEqual(['nouveaux'])
    } finally {
      await sa.dispose()
      await af.dispose()
    }
  })

  test('should reject a bad PATCH body (400) and unknown uuid (404), never 500', async ({}, testInfo) => {
    const api = await apiAs(testInfo, SUPER_ADMIN)
    try {
      const m = await trouverMessage(api, emailTest('holding', marqueur))
      expect((await api.patch(`/api/admin/messages/${m.uuid}`, { data: { statut: 'ARCHIVE' } })).status()).toBe(HTTP.BAD_REQUEST)
      expect((await api.patch(`/api/admin/messages/${m.uuid}`, { data: {} })).status()).toBe(HTTP.BAD_REQUEST)
      expect((await api.patch('/api/admin/messages/pas-un-uuid', { data: { statut: 'TRAITE' } })).status()).toBe(HTTP.BAD_REQUEST)
      expect((await api.patch('/api/admin/messages/00000000-0000-4000-8000-000000000000', { data: { statut: 'TRAITE' } })).status()).toBe(HTTP.NOT_FOUND)
    } finally {
      await api.dispose()
    }
  })
})

test.describe('UI /admin/messages', () => {
  test.beforeEach(async ({ context }) => {
    await loginAs(context, SUPER_ADMIN)
  })

  test('should show labelled details (never raw keys/values) and the form origin', async ({ page }) => {
    const messages = new MessagesPage(page)
    await messages.goto(`?q=${encodeURIComponent(emailTest('transport', marqueur))}`)

    const transport = messages.article(emailTest('transport', marqueur))
    await expect(transport).toHaveCount(1)
    await expect(transport.getByText('Type de transport', { exact: true })).toBeVisible()
    await expect(transport.getByText('Déménagement commercial', { exact: true })).toBeVisible()
    await expect(transport.getByText('Date souhaitée', { exact: true })).toBeVisible()
    await expect(transport.getByText('12 novembre 2026', { exact: true })).toBeVisible()
    await expect(transport.getByText('Site de la filiale', { exact: true })).toBeVisible()
    await expect(transport).not.toContainText('demenagement-commercial')
    await expect(transport).not.toContainText('2026-11-12')
    await expect(transport).not.toContainText('typeTransport')

    await messages.goto(`?q=${encodeURIComponent(emailTest('holding', marqueur))}`)
    await expect(messages.article(emailTest('holding', marqueur)).getByText('Site du groupe', { exact: true })).toBeVisible()
  })

  test('should show the suggested product and origin country of a product suggestion', async ({ page }) => {
    // Spec §1 (écran Messages) : « suggestion (produit, pays) ». Ces valeurs sont stockées
    // (produitSouhaite / paysOrigine) mais ne figurent ni dans le DTO ni dans `champs`.
    const messages = new MessagesPage(page)
    await messages.goto(`?q=${encodeURIComponent(emailTest('suggestion', marqueur))}`)
    const article = messages.article(emailTest('suggestion', marqueur))
    await expect(article).toHaveCount(1)
    await expect(article.getByText('Karité brut E2E')).toBeVisible()
    await expect(article.getByText('Mali')).toBeVisible()
  })

  test('should paginate 25 messages into 2 pages; page and filters survive reload and history', async ({ page }) => {
    const messages = new MessagesPage(page)
    await messages.goto(requetePagination)

    await expect(messages.articles).toHaveCount(TAILLE_PAGE)
    await expect(messages.pagination.getByText(`1–20 sur ${NOMBRE_MESSAGES_PAGINATION}`)).toBeVisible()
    await expect(messages.pagination.getByText('Page 1 / 2')).toBeVisible()
    await expect(messages.precedent).toBeDisabled()

    await messages.suivant.click()
    await expect(page).toHaveURL(/page=2/)
    await expect(messages.pagination.getByText(`21–25 sur ${NOMBRE_MESSAGES_PAGINATION}`)).toBeVisible()
    await expect(messages.articles).toHaveCount(NOMBRE_MESSAGES_PAGINATION - TAILLE_PAGE)
    await expect(messages.suivant).toBeDisabled()

    await page.reload()
    await expect(page).toHaveURL(/page=2/)
    await expect(messages.pagination.getByText(`21–25 sur ${NOMBRE_MESSAGES_PAGINATION}`)).toBeVisible()
    await expect(messages.recherche).toHaveValue(sujetPagination)

    await page.goBack()
    await expect(messages.pagination.getByText(`1–20 sur ${NOMBRE_MESSAGES_PAGINATION}`)).toBeVisible()
    await page.goForward()
    await expect(messages.pagination.getByText(`21–25 sur ${NOMBRE_MESSAGES_PAGINATION}`)).toBeVisible()
  })

  test('should fall back to the last page when the URL page is out of range', async ({ page }) => {
    const messages = new MessagesPage(page)
    await messages.goto(`${requetePagination}&page=9`)
    await expect(messages.pagination.getByText(`21–25 sur ${NOMBRE_MESSAGES_PAGINATION}`)).toBeVisible()
  })

  test('should keep type/status/search filters in the URL, reset the page on change and restore them on reload', async ({ page }) => {
    const messages = new MessagesPage(page)
    await messages.goto(`${requetePagination}&page=2`)
    await expect(messages.pagination.getByText('Page 2 / 2')).toBeVisible()

    await messages.choisirFiltre('Statut', 'Nouveau')
    await expect(page).toHaveURL(/statut=NOUVEAU/)
    await expect(page, 'changer un filtre revient à la page 1').not.toHaveURL(/page=2/)
    await expect(messages.pagination.getByText(`1–20 sur ${NOMBRE_MESSAGES_PAGINATION}`)).toBeVisible()

    await page.reload()
    await expect(messages.filtre('Statut')).toHaveText('Nouveau')
    await expect(messages.recherche).toHaveValue(sujetPagination)
    await expect(messages.pagination.getByText(`1–20 sur ${NOMBRE_MESSAGES_PAGINATION}`)).toBeVisible()

    await messages.recherche.fill(emailTest('suggestion', marqueur))
    await expect(page).toHaveURL((url) => url.searchParams.get('q') === emailTest('suggestion', marqueur))
    await expect(messages.articles).toHaveCount(1)
    await messages.choisirFiltre('Type', 'Suggestion de produit')
    await expect(page).toHaveURL(/type=SUGGESTION_PRODUIT/)
    await page.reload()
    await expect(messages.filtre('Type')).toHaveText('Suggestion de produit')
    await expect(messages.articles).toHaveCount(1)

    await messages.choisirFiltre('Type', 'Contact')
    await expect(page.getByText('Aucun message ne correspond à ces filtres.')).toBeVisible()
    await page.getByRole('button', { name: 'Réinitialiser' }).first().click()
    await expect(page).not.toHaveURL(/type=|statut=|q=/)
  })

  test('should update a status: toast, badge, and decrement the sidebar unread counter', async ({ page }, testInfo) => {
    const sa = await apiAs(testInfo, SUPER_ADMIN)
    try {
      const messages = new MessagesPage(page)
      const shell = new AdminShell(page)
      const courriel = emailTest('pag-05', marqueur)

      const avant = ((await (await sa.get('/api/admin/messages/compteurs')).json()) as { nouveaux: number }).nouveaux
      await messages.goto(`?q=${encodeURIComponent(courriel)}`)
      const article = messages.article(courriel)
      await expect(article).toHaveCount(1)
      await expect(messages.badgeStatut(article)).toHaveText('Nouveau')
      expect(await shell.compteurSidebar(), 'badge initial = compteur API').toBe(avant)

      await messages.changerStatut(article, 'En cours')
      await expect(messages.toast('Statut mis à jour.')).toBeVisible()
      await expect(messages.badgeStatut(article)).toHaveText('En cours')
      await expect.poll(async () => shell.compteurSidebar(), { message: 'compteur sidebar décrémenté' }).toBe(avant - 1)

      // Persistance : statut lu par l'API, et le passage TRAITE ne redécrémente pas.
      expect((await trouverMessage(sa, courriel)).statut).toBe('EN_COURS')
      await messages.changerStatut(article, 'Traité')
      await expect(messages.badgeStatut(article)).toHaveText('Traité')
      expect((await trouverMessage(sa, courriel)).statut).toBe('TRAITE')
      const apres = ((await (await sa.get('/api/admin/messages/compteurs')).json()) as { nouveaux: number }).nouveaux
      expect(apres).toBe(avant - 1)
    } finally {
      await sa.dispose()
    }
  })

  test('should convert a message to a client (201, lowercase email, PROSPECT, message site) then toast.info on the 409', async ({ page }, testInfo) => {
    const sa = await apiAs(testInfo, SUPER_ADMIN)
    try {
      const messages = new MessagesPage(page)
      const courrielMixte = emailTest('Client.Casse', marqueur).replace(/@example\.test$/, '@Example.TEST')
      const courrielAttendu = courrielMixte.toLowerCase()
      await messages.goto(`?q=${encodeURIComponent(courrielAttendu)}`)
      const article = messages.article(new RegExp(courrielAttendu.replace(/[.]/g, '\\.'), 'i'))
      await expect(article).toHaveCount(1)

      await article.getByRole('button', { name: 'Ajouter aux clients' }).click()
      await expect(messages.toast('Contact ajouté aux clients.')).toBeVisible()

      const liste = (await (await sa.get(`/api/admin/clients?q=${encodeURIComponent(courrielAttendu)}`)).json()) as AdminPage<AdminClientDto>
      expect(liste.total).toBe(1)
      const client = liste.items[0]!
      expect(client.email).toBe(courrielAttendu)
      expect(client.statut).toBe('PROSPECT')
      expect(client.site.slug).toBe('entretien')
      expect(client.notes).toBe('Conversion e2e (courriel en casse mixte)')
      expect(client.nom).toBe('Casse Client')
      expect(clesInterdites(liste)).toEqual([])

      await article.getByRole('button', { name: 'Ajouter aux clients' }).click()
      await expect(messages.toast('Ce contact figure déjà dans les clients.')).toBeVisible()
      const encore = (await (await sa.get(`/api/admin/clients?q=${encodeURIComponent(courrielAttendu)}`)).json()) as AdminPage<AdminClientDto>
      expect(encore.total, 'aucun doublon après le 409').toBe(1)

      // Le même contact converti via l'API renvoie bien 409 (et non 500 / doublon).
      const message = await trouverMessage(sa, courrielAttendu)
      expect((await sa.post(`/api/admin/messages/${message.uuid}/client`)).status()).toBe(HTTP.CONFLICT)
    } finally {
      await sa.dispose()
    }
  })

  test('should delete a message only after confirming the AlertDialog, then toast and update the total', async ({ page }) => {
    const messages = new MessagesPage(page)
    const courriel = emailTest('pag-25', marqueur)
    await messages.goto(requetePagination)
    await messages.suivant.click()
    const article = messages.article(courriel)
    await expect(article).toHaveCount(1)

    await article.getByRole('button', { name: 'Supprimer' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog.getByText('Supprimer ce message ?')).toBeVisible()
    await dialog.getByRole('button', { name: 'Annuler' }).click()
    await expect(dialog).toBeHidden()
    await expect(article).toHaveCount(1)

    await article.getByRole('button', { name: 'Supprimer' }).click()
    await dialog.getByRole('button', { name: 'Supprimer' }).click()
    await expect(messages.toast('Message supprimé.')).toBeVisible()
    await expect(messages.article(courriel)).toHaveCount(0)
    await expect(messages.pagination.getByText(`sur ${NOMBRE_MESSAGES_PAGINATION - 1}`)).toBeVisible()
  })

  test('should show only their own site to an ADMIN_FILIALE (no site filter, no foreign message)', async ({ page, context }) => {
    await context.clearCookies()
    await loginAs(context, ADMIN_FILIALE_ENTRETIEN)
    const messages = new MessagesPage(page)
    await messages.goto(`?q=${encodeURIComponent(marqueur)}`)
    await expect(messages.articles.first()).toBeVisible()
    await expect(messages.filtres.getByRole('combobox', { name: 'Site' })).toHaveCount(0)
    await expect(messages.article(emailTest('ccdpaa', marqueur))).toHaveCount(0)
    await expect(messages.article(emailTest('transport', marqueur))).toHaveCount(0)
  })
})
