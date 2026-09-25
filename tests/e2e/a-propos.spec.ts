// /a-propos — holding (spec phase 2 §4.9 "Vérification de bout en bout"). Couvre :
//  1. Le rendu public depuis la base (histoire, repères, équipe, partenaires) sans hôte externe.
//  2. Le parcours CMS admin équipe : créer / éditer / réordonner / supprimer, avec de VRAIES
//     assertions en base via l'API publique (pas seulement le DOM admin).
//  3. L'invalidation ISR : une édition est visible IMMÉDIATEMENT sur la page publique.
//  4. L'édition des sections (`*accent*`, échappement — jamais de `v-html`).
//  5. Le réordonnancement des partenaires, répercuté sur la page publique.
// Chaque test qui mute des données restaure l'état d'origine, y compris en cas d'échec
// (try/finally) — spec §4.8 "chaque test restaure ce qu'il modifie".
import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { loginAs, SUPER_ADMIN } from './helpers/auth'

const EXTERNAL_HOST_ALLOWLIST = ['localhost']

test.describe('À propos — holding, contenu public depuis la base', () => {
  test('should render histoire, repères, équipe and partenaires from the database with no external host request', async ({ page }) => {
    const externalRequests: string[] = []
    page.on('request', (req) => {
      const url = new URL(req.url())
      if (url.protocol.startsWith('http') && !EXTERNAL_HOST_ALLOWLIST.includes(url.hostname)) {
        externalRequests.push(req.url())
      }
    })

    const response = await page.goto('/a-propos')
    expect(response?.status()).toBe(200)

    // Histoire (titre accentué rendu par TexteAccentue, jamais de v-html)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // Repères : au moins un chiffre calculé (effectif) affiché
    await expect(page.locator('aside').getByText(/\d/).first()).toBeVisible()

    // Équipe : 3 membres seedés pour la holding, initiales en repli (aucune photo externe)
    const equipeSection = page.locator('section', { has: page.getByText('Claire Dubois') })
    await expect(equipeSection.getByText('Claire Dubois')).toBeVisible()
    await expect(equipeSection.getByText('Étienne Larose')).toBeVisible()
    await expect(equipeSection.getByText('Mariama Sow')).toBeVisible()

    // Partenaires : 3 organisations seedées
    await expect(page.getByText('Chambre de commerce du Montréal métropolitain')).toBeVisible()
    await expect(page.getByText('Investissement Québec')).toBeVisible()
    await expect(page.getByText('Fondation Kanpe')).toBeVisible()

    expect(externalRequests, `Requêtes vers un hôte externe détectées : ${externalRequests.join(', ')}`).toHaveLength(0)
  })
})

test.describe('Parcours CMS admin — équipe (holding)', () => {
  test.describe.configure({ mode: 'serial' })
  let adminContext: BrowserContext

  test.beforeAll(async ({ browser }) => {
    adminContext = await browser.newContext()
    await loginAs(adminContext, SUPER_ADMIN)
  })

  test.afterAll(async () => {
    await adminContext.close()
  })

  test('should create, edit, reorder and delete a team member with real database assertions via the public API', async () => {
    const uniqueName = `E2E Membre Test ${Date.now()}`
    const page = await adminContext.newPage()

    try {
      await page.goto('/admin/contenu/equipe')
      await expect(page.getByRole('button', { name: 'Ajouter un membre' })).toBeVisible()

      // --- Création ---
      await page.getByRole('button', { name: 'Ajouter un membre' }).click()
      const createDialog = page.getByRole('dialog')
      await createDialog.getByLabel('Nom').fill(uniqueName)
      await createDialog.getByLabel('Poste').fill('Poste de test e2e')
      await createDialog.getByLabel('Biographie').fill('Bio initiale du test e2e.')
      await createDialog.getByRole('button', { name: 'Enregistrer' }).click()
      await expect(page.getByText('Fiche ajoutée.')).toBeVisible()
      const row = page.locator('li', { hasText: uniqueName })
      await expect(row).toBeVisible()

      await expect
        .poll(async () => {
          const list = await adminContext.request.get('/api/public/sites/holding/equipe').then((r) => r.json())
          return (list as Array<{ nom: string }>).some((m) => m.nom === uniqueName)
        }, { message: 'Le nouveau membre doit apparaître via GET /api/public/sites/holding/equipe' })
        .toBe(true)

      // --- Édition ---
      await row.getByRole('button', { name: 'Modifier' }).click()
      const editDialog = page.getByRole('dialog')
      await editDialog.getByLabel('Biographie').fill('Bio modifiée par le test e2e.')
      await editDialog.getByRole('button', { name: 'Enregistrer' }).click()
      await expect(page.getByText('Fiche mise à jour.')).toBeVisible()

      await expect
        .poll(async () => {
          const list = await adminContext.request.get('/api/public/sites/holding/equipe').then((r) => r.json())
          return (list as Array<{ nom: string; bio: string | null }>).find((m) => m.nom === uniqueName)?.bio
        })
        .toBe('Bio modifiée par le test e2e.')

      // --- Réordonnancement : le nouveau membre est en dernière position (ordre = max+1) ---
      const beforeMove = await adminContext.request.get('/api/public/sites/holding/equipe').then((r) => r.json())
      const originalIndex = (beforeMove as Array<{ nom: string }>).findIndex((m) => m.nom === uniqueName)
      expect(originalIndex).toBeGreaterThan(0)

      await row.getByRole('button', { name: `Monter « ${uniqueName} »` }).click()
      await expect
        .poll(async () => {
          const list = await adminContext.request.get('/api/public/sites/holding/equipe').then((r) => r.json())
          return (list as Array<{ nom: string }>).findIndex((m) => m.nom === uniqueName)
        })
        .toBe(originalIndex - 1)

      // On redescend pour restaurer l'ordre des membres seedés avant suppression.
      await row.getByRole('button', { name: `Descendre « ${uniqueName} »` }).click()
      await expect
        .poll(async () => {
          const list = await adminContext.request.get('/api/public/sites/holding/equipe').then((r) => r.json())
          return (list as Array<{ nom: string }>).findIndex((m) => m.nom === uniqueName)
        })
        .toBe(originalIndex)

      // --- Suppression ---
      await row.getByRole('button', { name: 'Supprimer' }).click()
      const confirmDialog = page.getByRole('alertdialog')
      await confirmDialog.getByRole('button', { name: 'Supprimer' }).click()
      // Le toast auto-dismiss peut disparaître avant l'assertion sur un flux aussi long
      // (création + édition + 2 réordonnancements avant d'arriver ici) : on vérifie la
      // disparition de la ligne dans la liste admin, une preuve plus fiable, puis l'état réel
      // en base via l'API publique.
      await expect(row).toHaveCount(0)

      await expect
        .poll(async () => {
          const list = await adminContext.request.get('/api/public/sites/holding/equipe').then((r) => r.json())
          return (list as Array<{ nom: string }>).some((m) => m.nom === uniqueName)
        })
        .toBe(false)
    } finally {
      // Filet de sécurité : si une assertion échoue avant la suppression, on nettoie quand même.
      const remaining = await adminContext.request.get('/api/public/sites/holding/equipe').then((r) => r.json())
      const leftover = (remaining as Array<{ uuid: string; nom: string }>).find((m) => m.nom === uniqueName)
      if (leftover) {
        const adminList = await adminContext.request.get('/api/admin/contenu/equipe?site=holding').then((r) => r.json())
        const adminItem = (adminList as Array<{ uuid: string; nom: string }>).find((m) => m.nom === uniqueName)
        if (adminItem) await adminContext.request.delete(`/api/admin/contenu/equipe/${adminItem.uuid}`)
      }
      await page.close()
    }
  })

  test('should make an admin edit visible immediately on the public page (ISR invalidation)', async () => {
    const publicPage = await adminContext.newPage()
    const adminPage = await adminContext.newPage()
    let originalBio: string | null = null

    async function setBio(page: Page, bio: string): Promise<void> {
      await page.goto('/admin/contenu/equipe')
      const row = page.locator('li', { hasText: 'Claire Dubois' })
      await row.getByRole('button', { name: 'Modifier' }).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByLabel('Biographie').fill(bio)
      await dialog.getByRole('button', { name: 'Enregistrer' }).click()
      await expect(page.getByText('Fiche mise à jour.')).toBeVisible()
    }

    try {
      const before = await adminContext.request.get('/api/public/sites/holding/equipe').then((r) => r.json())
      const claire = (before as Array<{ nom: string; bio: string | null }>).find((m) => m.nom === 'Claire Dubois')
      expect(claire, 'Claire Dubois doit exister dans le seed holding').toBeTruthy()
      originalBio = claire!.bio

      const newBio = `Bio modifiée par le test e2e — invalidation ISR ${Date.now()}.`
      await setBio(adminPage, newBio)

      // Navigation fraîche (pas de SPA) : preuve que la purge `cache:nitro:routes` a bien eu
      // lieu, sinon la page ISR renverrait le HTML mis en cache avant l'édition (spec §4.2/§4.9).
      await publicPage.goto('/a-propos')
      await expect(publicPage.getByText(newBio)).toBeVisible()
    } finally {
      if (originalBio !== null) {
        await setBio(adminPage, originalBio)
        await publicPage.goto('/a-propos')
        await expect(publicPage.getByText(originalBio)).toBeVisible()
      }
      await publicPage.close()
      await adminPage.close()
    }
  })

  test('should render *accent* markup from a section edit and escape unsafe input (no v-html)', async () => {
    const adminPage = await adminContext.newPage()
    const publicPage = await adminContext.newPage()
    let originalTitre: string | null = null

    async function setHistoireTitre(page: Page, titre: string): Promise<void> {
      await page.goto('/admin/contenu')
      const aProposGroup = page.locator('section', { has: page.getByRole('heading', { name: 'À propos' }) })
      const histoireRow = aProposGroup.locator('li', { hasText: 'histoire' })
      await histoireRow.getByRole('button', { name: 'Modifier' }).click()
      const dialog = page.getByRole('dialog')
      // `getByLabel('Titre')` matche aussi "Surtitre *" (sous-chaîne, insensible à la casse) et
      // l'accessible name réel inclut l'astérisque de champ requis ("Titre *", pas "Titre" exact) —
      // regex ancrée en début de chaîne pour cibler uniquement ce champ.
      await dialog.getByLabel(/^Titre/i).fill(titre)
      await dialog.getByRole('button', { name: 'Enregistrer' }).click()
      await expect(page.getByText('Section mise à jour.')).toBeVisible()
    }

    try {
      const before = await adminContext.request
        .get('/api/public/sites/holding/sections?page=A_PROPOS')
        .then((r) => r.json())
      originalTitre = (before as { histoire?: { titre?: string } }).histoire?.titre ?? null
      expect(originalTitre, 'La section A_PROPOS.histoire doit avoir une valeur par défaut (seed)').toBeTruthy()

      const marker = `E2E${Date.now()}`
      const injectedTitre = `*accent-${marker}*<img src=x onerror="window.__xss=true">`
      await setHistoireTitre(adminPage, injectedTitre)

      await publicPage.goto('/a-propos')
      const heading = publicPage.getByRole('heading', { level: 1 })
      const accentSegment = heading.locator('em')
      await expect(accentSegment).toHaveText(`accent-${marker}`)
      // Le reste du texte (y compris le faux tag <img>) est un noeud texte échappé : ni image
      // rendue, ni script exécuté — preuve qu'aucun `v-html` n'est utilisé (CLAUDE.md §Dashboard).
      await expect(publicPage.locator('img[src="x"]')).toHaveCount(0)
      const xssFlag = await publicPage.evaluate(() => (window as unknown as { __xss?: boolean }).__xss)
      expect(xssFlag).toBeUndefined()
      await expect(heading).toContainText('<img src=x')
    } finally {
      if (originalTitre !== null) {
        await setHistoireTitre(adminPage, originalTitre)
        await expect
          .poll(async () => {
            const restored = await adminContext.request
              .get('/api/public/sites/holding/sections?page=A_PROPOS')
              .then((r) => r.json())
            return (restored as { histoire?: { titre?: string } }).histoire?.titre
          }, { message: 'Le titre original doit être restauré en base' })
          .toBe(originalTitre)
      }
      await adminPage.close()
      await publicPage.close()
    }
  })

  test('should reflect a partenaires reorder immediately on the public page', async () => {
    const adminPage = await adminContext.newPage()
    const publicPage = await adminContext.newPage()
    const first = 'Chambre de commerce du Montréal métropolitain'
    const second = 'Investissement Québec'
    let moved = false

    try {
      await adminPage.goto('/admin/contenu/partenaires')
      const row = adminPage.locator('li', { hasText: first })
      await expect(row).toBeVisible()
      await row.getByRole('button', { name: `Descendre « ${first} »` }).click()
      moved = true

      await expect
        .poll(async () => {
          const list = await adminContext.request.get('/api/public/sites/holding/partenaires').then((r) => r.json())
          return (list as Array<{ nom: string }>).findIndex((p) => p.nom === first)
        })
        .toBe(1)

      await publicPage.goto('/a-propos')
      // `.font-display.font-bold` seul matche aussi le chiffre "6" des repères (même classes,
      // `text-3xl` au lieu de `text-xl`) — `.text-xl` désambiguïse vers les noms de partenaires.
      const partenairesNames = publicPage.locator('li p.font-display.text-xl.font-bold')
      await expect(partenairesNames.nth(0)).toHaveText(second)
      await expect(partenairesNames.nth(1)).toHaveText(first)
    } finally {
      if (moved) {
        await adminPage.goto('/admin/contenu/partenaires')
        const rowAgain = adminPage.locator('li', { hasText: first })
        await rowAgain.getByRole('button', { name: `Monter « ${first} »` }).click()
        await expect
          .poll(async () => {
            const list = await adminContext.request.get('/api/public/sites/holding/partenaires').then((r) => r.json())
            return (list as Array<{ nom: string }>).findIndex((p) => p.nom === first)
          })
          .toBe(0)
      }
      await adminPage.close()
      await publicPage.close()
    }
  })
})
