import { test, expect, type Page } from '@playwright/test'
import { SUPER_ADMIN } from './helpers/auth'

// Lot 8 — sous-domaines (spec docs/specs/lot8-sous-domaines.md, §T3) : `*.localhost` résout
// vers 127.0.0.1 dans Chromium/Brave — aucun DNS. Hôte non connu du registre SITE_HOSTS
// (`hoteConnu: false`) : mode sous-domaine actif (chemins nus, dispatchers), liens
// inter-sites et canonical absents — voir parseSiteHost.
//
// Notes d'instrumentation : `framenavigated` et `waitForURL` (until load) déclenchent aussi
// sur les navigations same-document (pushState) dans Playwright — l'identité du document se
// mesure donc via un marqueur `window` perdu à tout rechargement réel.

const ENTRETIEN = 'http://entretien.localhost:3200'
const ADMIN = 'http://admin.localhost:3200'

function racine(page: Page) {
  return page.locator('[data-site]').first()
}

async function marqueurDocument(page: Page): Promise<void> {
  await page.evaluate(() => {
    ;(window as unknown as { marqueurE2E?: number }).marqueurE2E = 1
  })
}

test.describe('sous-domaines — chemins nus filiale', () => {
  test('GET /services sur entretien.localhost sert la page services de la filiale', async ({ page }) => {
    const response = await page.goto(`${ENTRETIEN}/services`)
    expect(response?.status()).toBe(200)
    await expect(racine(page)).toHaveAttribute('data-site', 'entretien')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('dispatcher : /, /a-propos, /contact, /realisations servent la filiale, pas la holding', async ({ page }) => {
    for (const chemin of ['/', '/a-propos', '/contact', '/realisations']) {
      await page.goto(`${ENTRETIEN}${chemin}`)
      await expect(racine(page), `chemin ${chemin}`).toHaveAttribute('data-site', 'entretien')
      await expect(page.getByRole('heading', { level: 1 }).first(), `chemin ${chemin}`).toBeVisible()
    }
  })

  test('dispatcher a-propos : contenu différent de la holding sur le même chemin', async ({ page }) => {
    await page.goto(`${ENTRETIEN}/a-propos`)
    const titreFiliale = await page.getByRole('heading', { level: 1 }).first().textContent()
    await page.goto('http://localhost:3200/a-propos')
    const titreHolding = await page.getByRole('heading', { level: 1 }).first().textContent()
    expect(titreFiliale).not.toBe(titreHolding)
  })

  test('navigation SPA : item Contact de la nav pointe /contact nu sans rechargement de document', async ({ page }) => {
    await page.goto(`${ENTRETIEN}/services`)
    await marqueurDocument(page)
    await page
      .getByRole('navigation', { name: 'Navigation principale' })
      .getByRole('link', { name: 'Contact', exact: true })
      .click()
    await page.waitForURL('**/contact')
    expect(page.url()).toBe(`${ENTRETIEN}/contact`)
    // Rechargement réel = nouvelle fenêtre = marqueur perdu ; pushState le conserve.
    const marqueur = await page.evaluate(
      () => (window as unknown as { marqueurE2E?: number }).marqueurE2E ?? 0,
    )
    expect(marqueur).toBe(1)
  })

  test('/confidentialite reste la page holding partagée sur le sous-domaine', async ({ page }) => {
    const response = await page.goto(`${ENTRETIEN}/confidentialite`)
    expect(response?.status()).toBe(200)
    // Page native = contenu groupe (useSiteSections(HOLDING_SLUG) — Loi 25 unique, spec
    // contact §2.1) ; le CHROME reste celui du site courant (D6) pour ne pas basculer de
    // header/footer en plein texte légal — data-site = slug de l'hôte.
    await expect(racine(page)).toHaveAttribute('data-site', 'entretien')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})

test.describe('sous-domaines — gate mode chemin (régression)', () => {
  test('GET /services sur localhost:3200 reste un 404 (validate)', async ({ page }) => {
    const response = await page.goto('http://localhost:3200/services')
    expect(response?.status()).toBe(404)
  })

  test('les clones nus admin ne masquent pas les routes publiques en mode chemin', async ({ page }) => {
    // admin/comptable et admin/placement ont des clones nus `/comptable` et `/placement` :
    // hors hôte admin ils sont retirés de la table (plugin admin-routes) — sinon la page
    // admin écraserait la filiale (statique bat param `[filiale]`).
    const comptable = await page.goto('http://localhost:3200/comptable')
    expect(comptable?.status()).toBe(200)
    await expect(racine(page)).toHaveAttribute('data-site', 'comptable')
    // `/placement` (filiale) et `/contenu` (clone nu SANS NOM du parent admin/contenu.vue,
    // revue M4) : même mécanique — 200 filiale et 404, jamais le shell admin.
    const placement = await page.goto('http://localhost:3200/placement')
    expect(placement?.status()).toBe(200)
    await expect(racine(page)).toHaveAttribute('data-site', 'placement')
    const contenu = await page.goto('http://localhost:3200/contenu')
    expect(contenu?.status()).toBe(404)
    // /utilisateurs (clone nu d'une page admin) : de retour en 404 comme avant le lot 8.
    const utilisateurs = await page.goto('http://localhost:3200/utilisateurs')
    expect(utilisateurs?.status()).toBe(404)
  })

  test('chemins nus spécifiques : /offres sur placement.localhost, /restaurant sur cdpaa.localhost', async ({ page }) => {
    await page.goto('http://placement.localhost:3200/offres')
    await expect(racine(page)).toHaveAttribute('data-site', 'placement')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    // /offres sur un AUTRE sous-domaine : 404 (validate filiale-specific).
    const offresHorsPlacement = await page.goto('http://entretien.localhost:3200/offres')
    expect(offresHorsPlacement?.status()).toBe(404)

    await page.goto('http://cdpaa.localhost:3200/restaurant')
    await expect(racine(page)).toHaveAttribute('data-site', 'cdpaa')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const restaurantHorsCdpaa = await page.goto('http://entretien.localhost:3200/restaurant')
    expect(restaurantHorsCdpaa?.status()).toBe(404)
  })
})

test.describe('sous-domaines — admin à chemins nus', () => {
  test('visiteur non connecté sur /utilisateurs nu est renvoyé vers /login nu', async ({ page }) => {
    await page.goto(`${ADMIN}/utilisateurs`)
    // La bascule vers /login peut être same-document (middleware client) : poll sur l'URL
    // plutôt que waitForURL('load') qui n'y se déclenche jamais.
    await expect.poll(() => new URL(page.url()).pathname).toBe('/login')
    expect(new URL(page.url()).searchParams.get('redirect')).toBe('/utilisateurs')
    await expect(page.getByRole('heading', { level: 1, name: 'Connexion' })).toBeVisible()
  })

  test('après connexion, / nu sert le tableau de bord admin', async ({ context, page }) => {
    const connexion = await context.request.post(`${ADMIN}/api/auth/login`, {
      data: { email: SUPER_ADMIN.email, password: SUPER_ADMIN.password },
    })
    expect(connexion.ok()).toBe(true)

    await page.goto(`${ADMIN}/`)
    await expect.poll(() => new URL(page.url()).pathname).toBe('/')
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  })
})
