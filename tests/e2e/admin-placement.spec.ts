import { test, expect, request as pwRequest, type TestInfo } from '@playwright/test'
import type { AdminCandidatDto, AdminCandidatureDto, AdminDemandeDto, AdminPage } from '#shared/types/admin'
import { SUPER_ADMIN, ADMIN_FILIALE_ENTRETIEN, loginAs } from './helpers/auth'
import { apiAs, clesInterdites } from './fixtures/admin-pages'
import { emailTest, nouveauMarqueur } from './fixtures/admin-data'
import { compterFichiersPlacement, purgerPlacement, semerPlacement } from './helpers/db'

const HTTP = { OK: 200, CREATED: 201, NO_CONTENT: 204, BAD_REQUEST: 400, FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409 } as const

let marqueur = ''

function baseURL(testInfo: TestInfo): string {
  return (testInfo.project.use.baseURL as string | undefined) || 'http://localhost:3200'
}

test.beforeAll(() => {
  marqueur = nouveauMarqueur('p')
  semerPlacement(marqueur)
})

test.afterAll(() => {
  purgerPlacement(marqueur)
})

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
test.describe('API /api/admin/placement', () => {
  test('requires a session, pins the placement site (403 foreign AF) and never leaks internal ids', async ({}, testInfo) => {
    const anon = await pwRequest.newContext({ baseURL: baseURL(testInfo) })
    try {
      expect((await anon.get('/api/admin/placement/candidats')).status(), 'sans session').toBe(401)
    } finally {
      await anon.dispose()
    }

    const af = await apiAs(testInfo, ADMIN_FILIALE_ENTRETIEN)
    const sa = await apiAs(testInfo, SUPER_ADMIN)
    try {
      expect((await af.get('/api/admin/placement/candidats')).status(), 'AF d’une autre filiale').toBe(HTTP.FORBIDDEN)
      expect((await af.get('/api/admin/placement/demandes')).status()).toBe(HTTP.FORBIDDEN)
      expect((await af.post('/api/admin/placement/candidats', { data: { nomComplet: 'X', email: 'x@example.test' } })).status()).toBe(HTTP.FORBIDDEN)

      const liste = await sa.get('/api/admin/placement/candidats')
      expect(liste.status()).toBe(HTTP.OK)
      expect(liste.headers()['cache-control']).toContain('no-store')
      const pageCandidats = (await liste.json()) as AdminPage<AdminCandidatDto>
      expect(pageCandidats.items.length).toBeGreaterThan(0)
      expect(pageCandidats.items.every((c) => c.site.slug === 'placement')).toBe(true)
      expect(clesInterdites(pageCandidats)).toEqual([])

      const candidatures = (await (await sa.get('/api/admin/placement/candidatures')).json()) as AdminPage<AdminCandidatureDto>
      expect(candidatures.items.length).toBeGreaterThan(0)
      expect(clesInterdites(candidatures)).toEqual([])
      // Un nom masqué sans date d'anonymisation = fuite de PII (invariant Loi 25).
      expect(candidatures.items.every((c) => c.anonymiseLe !== null || c.nomComplet !== null)).toBe(true)
    } finally {
      await af.dispose()
      await sa.dispose()
    }
  })

  test('candidat CRUD : courriel dédupliqué et replié en minuscules, sélection stricte, suppression', async ({}, testInfo) => {
    const sa = await apiAs(testInfo, SUPER_ADMIN)
    try {
      const corps = {
        nomComplet: 'Candidat API E2E',
        email: 'API-Cand@Example.test',
        telephone: '514-555-0100',
        posteRecherche: 'Chauffeur classe 1',
        categorie: 'CHAUFFEUR_CLASSE_1',
        statut: 'EN_PROCESSUS',
        origine: 'INTERNATIONAL',
      }
      const cree = await sa.post('/api/admin/placement/candidats', { data: corps })
      expect(cree.status()).toBe(HTTP.CREATED)
      const candidat = (await cree.json()) as AdminCandidatDto
      expect(candidat.email).toBe('api-cand@example.test')
      expect(candidat.statut).toBe('EN_PROCESSUS')
      expect(candidat.aCv).toBe(false)
      expect(clesInterdites(candidat)).toEqual([])

      expect((await sa.post('/api/admin/placement/candidats', { data: corps })).status(), 'doublon de courriel').toBe(HTTP.CONFLICT)
      expect((await sa.patch(`/api/admin/placement/candidats/${candidat.uuid}`, { data: {} })).status(), 'PATCH {}').toBe(HTTP.BAD_REQUEST)
      expect((await sa.patch(`/api/admin/placement/candidats/${candidat.uuid}`, { data: { companyId: 1 } })).status(), 'clé inconnue').toBe(HTTP.BAD_REQUEST)
      expect((await sa.patch('/api/admin/placement/candidats/pas-un-uuid', { data: { statut: 'PLACE' } })).status()).toBe(HTTP.BAD_REQUEST)
      const maj = await sa.patch(`/api/admin/placement/candidats/${candidat.uuid}`, { data: { statut: 'PLACE', disponibilite: '2 semaines' } })
      expect(maj.status()).toBe(HTTP.OK)
      expect(await maj.json()).toMatchObject({ statut: 'PLACE', disponibilite: '2 semaines' })

      const filtre = (await (await sa.get(`/api/admin/placement/candidats?q=${encodeURIComponent('Candidat API E2E')}`)).json()) as AdminPage<AdminCandidatDto>
      expect(filtre.items.some((c) => c.uuid === candidat.uuid)).toBe(true)
      expect((await sa.get('/api/admin/placement/candidats?statut=NOPE')).status()).toBe(HTTP.BAD_REQUEST)

      expect((await sa.delete(`/api/admin/placement/candidats/${candidat.uuid}`)).status()).toBe(HTTP.NO_CONTENT)
      expect((await sa.delete(`/api/admin/placement/candidats/${candidat.uuid}`)).status(), 'déjà supprimé').toBe(HTTP.NOT_FOUND)
    } finally {
      await sa.dispose()
    }
  })

  test('demande : jamais publiée à la création, publication exige les champs d’offre, dépublier, supprimer', async ({}, testInfo) => {
    const sa = await apiAs(testInfo, SUPER_ADMIN)
    try {
      const base = {
        entrepriseCliente: `[E2E ${marqueur}] API demande`,
        posteRecherche: 'Chauffeur classe 1',
        categorie: 'CHAUFFEUR_CLASSE_1',
        contactNom: 'Contact API E2E',
        contactEmail: `contact-api-${marqueur}@example.test`,
        description: 'Demande de test API.',
      }
      const cree = await sa.post('/api/admin/placement/demandes', { data: base })
      expect(cree.status()).toBe(HTTP.CREATED)
      const demande = (await cree.json()) as AdminDemandeDto
      expect(demande.publiee).toBe(false)
      expect(demande.dateDebut).toBe(null)
      expect(clesInterdites(demande)).toEqual([])

      expect((await sa.post('/api/admin/placement/demandes', { data: { ...base, publiee: true } })).status(), 'publiee à la création').toBe(HTTP.BAD_REQUEST)
      expect((await sa.patch(`/api/admin/placement/demandes/${demande.uuid}`, { data: { publiee: true } })).status(), 'publiee sans champs d’offre').toBe(HTTP.BAD_REQUEST)

      const published = await sa.patch(`/api/admin/placement/demandes/${demande.uuid}`, {
        data: {
          publiee: true,
          titreOffre: `Offre API ${marqueur}`,
          lieu: 'Montréal (Québec)',
          typeContrat: 'TEMPS_PARTIEL',
          salaire: '25 $/h',
          descriptionPublique: 'Description publique de test API.',
        },
      })
      expect(published.status()).toBe(HTTP.OK)
      const offre = (await published.json()) as AdminDemandeDto
      expect(offre.publiee).toBe(true)
      expect(offre.publieeLe).not.toBe(null)
      expect(offre.typeContrat).toBe('TEMPS_PARTIEL')

      const filtre = (await (await sa.get('/api/admin/placement/demandes?publiee=true')).json()) as AdminPage<AdminDemandeDto>
      expect(filtre.items.some((d) => d.uuid === demande.uuid)).toBe(true)

      const depublie = await sa.patch(`/api/admin/placement/demandes/${demande.uuid}`, { data: { publiee: false } })
      expect(depublie.status()).toBe(HTTP.OK)
      expect(((await depublie.json()) as AdminDemandeDto).publiee).toBe(false)

      expect((await sa.delete(`/api/admin/placement/demandes/${demande.uuid}`)).status()).toBe(HTTP.NO_CONTENT)
      expect((await sa.delete(`/api/admin/placement/demandes/${demande.uuid}`)).status()).toBe(HTTP.NOT_FOUND)
    } finally {
      await sa.dispose()
    }
  })

  test('affectations : assign → PLACE, dédoublonnage, retrait → DISPONIBLE, correspondants recalculés', async ({}, testInfo) => {
    const sa = await apiAs(testInfo, SUPER_ADMIN)
    try {
      const alice = emailTest('cand-vivier', marqueur)
      const demande = (await (
        await sa.post('/api/admin/placement/demandes', {
          data: {
            entrepriseCliente: `[E2E ${marqueur}] API affectations`,
            posteRecherche: 'Manutentionnaire',
            categorie: 'MANUTENTION',
            contactNom: 'Contact Afect E2E',
            contactEmail: `contact-affect-${marqueur}@example.test`,
            description: 'Demande de test des affectations.',
          },
        })
      ).json()) as AdminDemandeDto

      const avant = (await (await sa.get(`/api/admin/placement/demandes?q=${encodeURIComponent('API affectations')}`)).json()) as AdminPage<AdminDemandeDto>
      expect(avant.items[0]!.correspondants.some((c) => c.nomComplet?.includes('Alice'))).toBe(true)

      const candidat = (await (
        await sa.get(`/api/admin/placement/candidats?q=${encodeURIComponent(alice)}`)
      ).json()) as AdminPage<AdminCandidatDto>
      expect(candidat.items.length).toBe(1)
      const uAlice = candidat.items[0]!.uuid

      const ok = await sa.post(`/api/admin/placement/demandes/${demande.uuid}/affectations`, { data: { candidatUuid: uAlice } })
      expect(ok.status()).toBe(HTTP.CREATED)
      const assignee = (await ok.json()) as AdminDemandeDto
      const affectationUuid = assignee.affectations[0]!.uuid
      expect(assignee.affectations.some((a) => a.candidatUuid === uAlice)).toBe(true)
      expect(clesInterdites(assignee.affectations[0]!)).toEqual([])

      const apres = (await (await sa.get(`/api/admin/placement/demandes?q=${encodeURIComponent('API affectations')}`)).json()) as AdminPage<AdminDemandeDto>
      expect(apres.items[0]!.affectations.some((a) => a.candidatUuid === uAlice)).toBe(true)
      expect(apres.items[0]!.correspondants.some((c) => c.nomComplet?.includes('Alice'))).toBe(false)

      expect((await sa.post(`/api/admin/placement/demandes/${demande.uuid}/affectations`, { data: { candidatUuid: uAlice } })).status(), 'double affectation').toBe(HTTP.CONFLICT)

      const place = (await (
        await sa.get(`/api/admin/placement/candidats?q=${encodeURIComponent(alice)}`)
      ).json()) as AdminPage<AdminCandidatDto>
      expect(place.items[0]!.statut).toBe('PLACE')

      expect((await sa.delete(`/api/admin/placement/demandes/${demande.uuid}/affectations/${affectationUuid}`)).status()).toBe(HTTP.NO_CONTENT)
      const retour = (await (await sa.get(`/api/admin/placement/candidats?q=${encodeURIComponent(alice)}`)).json()) as AdminPage<AdminCandidatDto>
      expect(retour.items[0]!.statut).toBe('DISPONIBLE')

      expect((await sa.delete(`/api/admin/placement/demandes/${demande.uuid}`)).status()).toBe(HTTP.NO_CONTENT)
    } finally {
      await sa.dispose()
    }
  })

  test('vivier : copie du CV (fichier dédié), dédoublonnage 409, anonymisation Loi 25 irréversible et protégée', async ({}, testInfo) => {
    const sa = await apiAs(testInfo, SUPER_ADMIN)
    try {
      const ur = emailTest('cand-ur', marqueur)
      const pageCandur = (await (await sa.get('/api/admin/placement/candidatures?' + new URLSearchParams({ q: ur }))).json()) as AdminPage<AdminCandidatureDto>
      expect(pageCandur.items.length).toBe(1)
      const urUuid = pageCandur.items[0]!.uuid
      expect(pageCandur.items[0]!.offreTitre).toBe(`Offre de test ${marqueur}`)
      expect(pageCandur.items[0]!.documents.map((d) => d.nomOriginal)).toContain('cv-e2e.pdf')

      const fichiersAvant = compterFichiersPlacement()

      const vivier = await sa.post(`/api/admin/placement/candidatures/${urUuid}/vivier`, {})
      expect(vivier.status()).toBe(HTTP.CREATED)
      const candidat = (await vivier.json()) as AdminCandidatDto
      expect(candidat.email).toBe(ur)
      expect(candidat.aCv).toBe(true)
      expect(clesInterdites(candidat)).toEqual([])

      expect(compterFichiersPlacement()).toBe(fichiersAvant + 1)

      expect((await sa.post(`/api/admin/placement/candidatures/${urUuid}/vivier`, {})).status(), 'doublon du vivier').toBe(HTTP.CONFLICT)

      const anonymise = await sa.post(`/api/admin/placement/candidatures/${urUuid}/anonymiser`, {})
      expect(anonymise.status()).toBe(HTTP.OK)
      const dto = (await anonymise.json()) as AdminCandidatureDto
      expect(dto.anonymiseLe).not.toBe(null)
      expect(dto.nomComplet).toBe(null)
      expect(dto.documents).toEqual([])

      // Le CV de la candidature est effacé ; la copie du vivier, elle, survit (cycles Loi 25 découplés).
      expect(compterFichiersPlacement()).toBe(fichiersAvant)
      const vivierConserve = (await (await sa.get(`/api/admin/placement/candidats?q=${encodeURIComponent(ur)}`)).json()) as AdminPage<AdminCandidatDto>
      expect(vivierConserve.items[0]!.aCv).toBe(true)
      expect(vivierConserve.items[0]!.anonymiseLe).toBe(null)

      expect((await sa.post(`/api/admin/placement/candidatures/${urUuid}/anonymiser`, {})).status(), 'déjà anonymisée').toBe(HTTP.CONFLICT)

      // Une candidature déjà anonymisée (seed cand-anon) est un reste légal protégé : jamais réexposable.
      const anon = (await (await sa.get('/api/admin/placement/candidatures?' + new URLSearchParams({ q: emailTest('cand-anon', marqueur) }))).json()) as AdminPage<AdminCandidatureDto>
      expect(anon.items.length).toBe(1)
      expect(anon.items[0]!.anonymiseLe).not.toBe(null)
      expect((await sa.post(`/api/admin/placement/candidatures/${anon.items[0]!.uuid}/anonymiser`, {})).status()).toBe(HTTP.CONFLICT)
    } finally {
      await sa.dispose()
    }
  })
})

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------
test.describe('UI /admin/placement', () => {
  test.beforeEach(async ({ context }) => {
    await loginAs(context, SUPER_ADMIN)
  })

  test('listes les données seedées sur les trois onglets, PII masquées pour une anonymisée, pas de scroll horizontal à 375', async ({ page }) => {
    await page.goto('/admin/placement')
    await expect(page).toHaveURL(/\/admin\/placement\/candidats$/)
    await expect(page.getByRole('heading', { name: 'Placement' })).toBeVisible()
    const nav = page.getByRole('navigation', { name: 'Sections du placement' })
    await expect(nav.getByRole('link', { name: 'Candidats', exact: true })).toHaveAttribute('aria-current', 'page')

    // La colonne Contact (courriel/téléphone) est masquée sous 2xl (1536px) depuis le retour
    // design : on asserte la présence sur le nom, seule colonne visible à toutes les largeurs.
    await expect(page.getByText(`Alice Placement ${marqueur}`, { exact: true })).toBeVisible()
    await expect(page.getByText(`Claire Placée ${marqueur}`, { exact: true })).toBeVisible()

    await nav.getByRole('link', { name: 'Demandes', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/placement\/demandes$/)
    await expect(page.getByRole('article').filter({ hasText: 'Besoin manutention' })).toBeVisible()
    await expect(page.getByRole('article').filter({ hasText: 'Offre publique' })).toBeVisible()
    await expect(page.getByRole('article').filter({ hasText: 'Offre publique' }).getByText('Offre publiée', { exact: true })).toBeVisible()

    await nav.getByRole('link', { name: 'Candidatures', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/placement\/candidatures$/)
    const anonArticles = page.getByRole('article').filter({ hasText: 'Candidature anonymisée' })
    await expect(anonArticles.first()).toBeVisible()
    // PII des candidatures anonymisées (seed cand-anon, cand-ur anonymisée par le test API) : jamais réaffichées.
    await expect(page.getByText(`cand-ur-${marqueur}@example.test`, { exact: true })).toBeHidden()
    await expect(page.getByText(`cand-anon-${marqueur}@example.test`, { exact: true })).toBeHidden()

    const viewport = page.viewportSize()
    if (viewport && viewport.width < 1024) {
      const { sw, cw } = await page.evaluate(() => ({ sw: document.body.scrollWidth, cw: document.body.clientWidth }))
      expect(sw).toBeLessThanOrEqual(cw + 1)
    }
  })

  test('crée un candidat via le dialog et affiche le doublon de courriel sous le champ', async ({ page }) => {
    await page.goto('/admin/placement/candidats')
    const courriel = emailTest('ui-cand', marqueur)
    const dialog = page.getByRole('dialog')
    const remplir = async (): Promise<void> => {
      await dialog.getByLabel(/^Nom complet/).fill(`Candidat UI ${marqueur}`)
      await dialog.getByLabel(/^Courriel/).fill(courriel)
      await dialog.getByRole('combobox', { name: 'Catégorie' }).click()
      await page.getByRole('option', { name: 'Manutention / entrepôt' }).click()
      await dialog.getByRole('combobox', { name: 'Origine' }).click()
      await page.getByRole('option', { name: 'Local' }).click()
    }

    await page.getByRole('button', { name: 'Ajouter un candidat' }).click()
    await expect(dialog).toBeVisible()
    await remplir()
    await dialog.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByText('Candidat ajouté.', { exact: true })).toBeVisible()
    // Colonne Contact masquée sous 2xl : la ligne créée est visible par son nom.
    await expect(page.getByText(`Candidat UI ${marqueur}`, { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Ajouter un candidat' }).click()
    await remplir()
    await dialog.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Ce courriel existe déjà pour cette filiale.')).toBeVisible()
    await expect(page.getByText('Candidat ajouté.', { exact: true })).toBeHidden()
    await dialog.getByRole('button', { name: 'Annuler' }).click()
    await expect(dialog).toBeHidden()
  })

  test('public en offre une demande via le dialog, puis la dépublie', async ({ page }) => {
    await page.goto('/admin/placement/demandes')
    const article = page.getByRole('article').filter({ hasText: 'Besoin manutention' })
    await expect(article).toBeVisible()
    const interrupteur = article.getByRole('switch', { name: /Publier comme offre d'emploi/ })
    await expect(interrupteur).toBeVisible()

    await interrupteur.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByLabel(/^Titre de l'offre/).fill(`Offre UI ${marqueur}`)
    await dialog.getByLabel(/^Lieu/).fill('Montréal (Québec)')
    await dialog.getByRole('combobox', { name: 'Type de contrat' }).click()
    await page.getByRole('option', { name: 'Temps plein' }).click()
    await dialog.getByLabel(/^Description publique/).fill('Description publique de l’offre créée par l’e2e UI.')
    await dialog.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByText('Offre publiée.', { exact: true })).toBeVisible()
    await expect(article.getByText('Offre publiée', { exact: true })).toBeVisible()

    await interrupteur.click()
    await expect(page.getByText('Offre retirée.', { exact: true })).toBeVisible()
    await expect(article.getByText('Offre publiée', { exact: true })).toBeHidden()
  })

  test('ajoute au vivier puis anonymise (Loi 25) la candidature retenue via les dialogs', async ({ page }) => {
    await page.goto('/admin/placement/candidatures')
    const article = page.getByRole('article').filter({ hasText: 'Retenue E2E' })
    await expect(article).toBeVisible()
    await expect(article).toContainText('Retenue')

    await article.getByRole('button', { name: 'Ajouter au vivier' }).click()
    const vivier = page.getByRole('dialog')
    await expect(vivier).toBeVisible()
    await vivier.getByRole('button', { name: 'Ajouter au vivier' }).click()
    await expect(page.getByText('Candidat ajouté au vivier.', { exact: true })).toBeVisible()

    await article.getByRole('button', { name: 'Supprimer maintenant' }).click()
    const alert = page.getByRole('alertdialog')
    await expect(alert).toContainText('Loi 25')
    await alert.getByRole('button', { name: 'Supprimer maintenant' }).click()
    await expect(page.getByText('Candidature anonymisée.', { exact: true })).toBeVisible()

    const anonArticles = page.getByRole('article').filter({ hasText: 'Candidature anonymisée' })
    await expect(anonArticles).toHaveCount(3)
    await expect(page.getByText(`cand-retenue-${marqueur}@example.test`, { exact: true })).toBeHidden()
    await expect(page.getByText(`Retenue E2E ${marqueur}`, { exact: true })).toBeHidden()
  })
})