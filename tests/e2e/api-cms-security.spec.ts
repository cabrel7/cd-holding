// Sécurité des routes /api/admin/contenu/** (spec phase 2 §4.8, §4.2 "Contrats API"). Purement
// API (pas de page rendue) : rapide, indépendant du reste de la base, une session par test.
// N'écrit aucune donnée durable : les seules mutations testées (409, 400) sont volontairement
// rejetées par le serveur AVANT d'atteindre Prisma.
import { test, expect, type Browser, type BrowserContext } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { loginAs, SUPER_ADMIN, ADMIN_FILIALE_ENTRETIEN, EMPLOYE_ENTRETIEN } from './helpers/auth'

async function withContext<T>(browser: Browser, fn: (context: BrowserContext) => Promise<T>): Promise<T> {
  const context = await browser.newContext()
  try {
    return await fn(context)
  } finally {
    await context.close()
  }
}

test.describe('Sécurité API CMS admin — /api/admin/contenu/**', () => {
  test('should return 401 without a session', async ({ request }) => {
    const res = await request.get('/api/admin/contenu/equipe')
    expect(res.status()).toBe(401)
  })

  test('should return 403 for an EMPLOYE role (no CMS access)', async ({ browser }) => {
    await withContext(browser, async (context) => {
      await loginAs(context, EMPLOYE_ENTRETIEN)
      const res = await context.request.get('/api/admin/contenu/equipe')
      expect(res.status()).toBe(403)
    })
  })

  test('should return 403 when ADMIN_FILIALE requests a site outside its own (?site=holding)', async ({ browser }) => {
    await withContext(browser, async (context) => {
      await loginAs(context, ADMIN_FILIALE_ENTRETIEN)
      const res = await context.request.get('/api/admin/contenu/equipe?site=holding')
      expect(res.status()).toBe(403)
    })
  })

  test('should return 404 when ADMIN_FILIALE patches a holding team member (anti-enumeration)', async ({ browser }) => {
    const holdingMemberUuid = await withContext(browser, async (context) => {
      await loginAs(context, SUPER_ADMIN)
      const list = await context.request.get('/api/admin/contenu/equipe?site=holding').then((r) => r.json())
      const uuid = (list as Array<{ uuid: string }>)[0]?.uuid
      if (!uuid) throw new Error('Aucun membre holding trouvé pour préparer le test')
      return uuid
    })

    await withContext(browser, async (context) => {
      await loginAs(context, ADMIN_FILIALE_ENTRETIEN)
      const res = await context.request.patch(`/api/admin/contenu/equipe/${holdingMemberUuid}`, {
        data: { poste: 'Tentative non autorisée' },
      })
      expect(res.status()).toBe(404)
    })
  })

  test('should return 400 for a malformed uuid param', async ({ browser }) => {
    await withContext(browser, async (context) => {
      await loginAs(context, SUPER_ADMIN)
      const res = await context.request.patch('/api/admin/contenu/equipe/not-a-uuid', {
        data: { poste: 'x' },
      })
      expect(res.status()).toBe(400)
    })
  })

  test('should return 400 for an invalid body (nom too short)', async ({ browser }) => {
    await withContext(browser, async (context) => {
      await loginAs(context, SUPER_ADMIN)
      const list = await context.request.get('/api/admin/contenu/equipe?site=holding').then((r) => r.json())
      const uuid = (list as Array<{ uuid: string }>)[0]?.uuid
      if (!uuid) throw new Error('Aucun membre holding trouvé pour préparer le test')
      const res = await context.request.patch(`/api/admin/contenu/equipe/${uuid}`, { data: { nom: 'a' } })
      expect(res.status()).toBe(400)
    })
  })

  test('should return 409 when marking a 4th service as misEnAvant for a filiale', async ({ browser }) => {
    await withContext(browser, async (context) => {
      await loginAs(context, SUPER_ADMIN)
      const services = await context.request
        .get('/api/admin/contenu/services?site=entretien')
        .then((r) => r.json())
      const notFeatured = (services as Array<{ uuid: string; misEnAvant: boolean }>).find((s) => !s.misEnAvant)
      expect(notFeatured, 'entretien doit avoir au moins un service non mis en avant (3 sur les autres)').toBeTruthy()

      const res = await context.request.patch(`/api/admin/contenu/services/${notFeatured!.uuid}`, {
        data: { misEnAvant: true },
      })
      expect(res.status()).toBe(409)
    })
  })

  test('should return 400 for an image key that does not resolve to a public file of the same filiale', async ({ browser }) => {
    await withContext(browser, async (context) => {
      await loginAs(context, SUPER_ADMIN)
      const list = await context.request.get('/api/admin/contenu/equipe?site=holding').then((r) => r.json())
      const uuid = (list as Array<{ uuid: string }>)[0]?.uuid
      if (!uuid) throw new Error('Aucun membre holding trouvé pour préparer le test')

      // Clé bien formée (regex STORAGE_KEY_PATTERN) mais qui ne correspond à aucun Fichier —
      // exercice de `assertPublicImages`, pas de la validation zod du format.
      const nonExistentKey = `${randomUUID()}.png`
      const res = await context.request.patch(`/api/admin/contenu/equipe/${uuid}`, {
        data: { photoKey: nonExistentKey },
      })
      expect(res.status()).toBe(400)
    })
  })
})
