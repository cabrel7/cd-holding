// Page Objects et utilitaires partagés des specs admin du lot 4 (shell, messages, clients).
// Sélecteurs sémantiques uniquement (rôles, libellés) ; jamais de mot de passe ici (helpers/auth).
import { expect, request as pwRequest, type APIRequestContext, type Locator, type Page, type TestInfo } from '@playwright/test'
import type { AdminAccount } from '../helpers/auth'

const BASE_URL_DEFAUT = 'http://localhost:3200'
const LARGEUR_TABLETTE = 768

/** Contexte d'API authentifié (cookie de session propre) — sans navigateur. */
export async function apiAs(testInfo: TestInfo, account: AdminAccount): Promise<APIRequestContext> {
  const baseURL = (testInfo.project.use.baseURL as string | undefined) || BASE_URL_DEFAUT
  const api = await pwRequest.newContext({ baseURL })
  const res = await api.post('/api/auth/login', { data: { email: account.email, password: account.password } })
  if (!res.ok()) {
    await api.dispose()
    throw new Error(`Connexion API échouée (${res.status()}) pour ${account.email}`)
  }
  return api
}

/** Clés interdites dans une réponse admin : `id`, `*Id` (FK internes) et `details` brut. */
export function clesInterdites(value: unknown, chemin = '$'): string[] {
  const trouvees: string[] = []
  if (Array.isArray(value)) {
    value.forEach((v, i) => trouvees.push(...clesInterdites(v, `${chemin}[${i}]`)))
  } else if (value !== null && typeof value === 'object') {
    for (const [cle, v] of Object.entries(value)) {
      if (cle === 'id' || cle === 'details' || /Id$/.test(cle)) trouvees.push(`${chemin}.${cle}`)
      trouvees.push(...clesInterdites(v, `${chemin}.${cle}`))
    }
  }
  return trouvees
}

export function estMobile(page: Page): boolean {
  const viewport = page.viewportSize()
  return viewport !== null && viewport.width < LARGEUR_TABLETTE
}

// --- Shell ----------------------------------------------------------------------------------
export class AdminShell {
  constructor(private readonly page: Page) {}

  get navigation(): Locator {
    return this.page.getByRole('navigation', { name: 'Navigation de la console' })
  }

  get menuTrigger(): Locator {
    return this.page.getByRole('button', { name: /Ouvrir le menu|Réduire le menu/ })
  }

  /** Sur mobile, la navigation est dans un Sheet fermé : l'ouvre. No-op sur desktop. */
  async ouvrirNavigation(): Promise<void> {
    if (estMobile(this.page)) {
      if (!(await this.navigation.isVisible())) await this.menuTrigger.click()
    }
    await expect(this.navigation).toBeVisible()
  }

  async fermerNavigation(): Promise<void> {
    if (estMobile(this.page) && (await this.navigation.isVisible())) {
      await this.page.keyboard.press('Escape')
      await expect(this.navigation).toBeHidden()
    }
  }

  get logoutButton(): Locator {
    return this.page.getByRole('banner').getByRole('button', { name: /Déconnexion|Se déconnecter/ })
  }

  get logoutDialog(): Locator {
    return this.page.getByRole('alertdialog')
  }

  /** Nombre de messages non lus lu sur le badge de la sidebar (null si aucun badge). */
  async compteurSidebar(): Promise<number | null> {
    await this.ouvrirNavigation()
    const badge = this.navigation.getByRole('img', { name: /messages? non lus?/ })
    const present = (await badge.count()) > 0
    const valeur = present ? Number.parseInt((await badge.getAttribute('aria-label')) ?? '', 10) : null
    await this.fermerNavigation()
    return valeur
  }
}

// --- Login ----------------------------------------------------------------------------------
export class LoginPage {
  constructor(private readonly page: Page) {}

  goto(redirect?: string) {
    return this.page.goto(redirect === undefined ? '/admin/login' : `/admin/login?redirect=${encodeURIComponent(redirect)}`)
  }

  async submit(email: string, password: string): Promise<void> {
    await this.page.getByLabel('Courriel').fill(email)
    await this.page.getByLabel('Mot de passe').fill(password)
    await this.page.getByRole('button', { name: /Se connecter|Connexion en cours/ }).click()
  }

  erreur(texte: string | RegExp): Locator {
    return this.page.getByRole('alert').filter({ hasText: texte })
  }
}

// --- Messages -------------------------------------------------------------------------------
export class MessagesPage {
  constructor(private readonly page: Page) {}

  goto(query = '') {
    return this.page.goto(`/admin/messages${query}`)
  }

  get filtres(): Locator {
    return this.page.getByRole('search', { name: 'Filtrer les messages' })
  }

  get recherche(): Locator {
    return this.filtres.getByLabel('Recherche')
  }

  filtre(nom: 'Site' | 'Type' | 'Statut'): Locator {
    return this.filtres.getByRole('combobox', { name: nom })
  }

  async choisirFiltre(nom: 'Site' | 'Type' | 'Statut', option: string): Promise<void> {
    await this.filtre(nom).click()
    await this.page.getByRole('option', { name: option, exact: true }).click()
  }

  get articles(): Locator {
    return this.page.getByRole('article')
  }

  article(courriel: string | RegExp): Locator {
    return this.articles.filter({ hasText: courriel })
  }

  get pagination(): Locator {
    return this.page.getByRole('navigation', { name: 'Pagination' })
  }

  get suivant(): Locator {
    return this.pagination.getByRole('button', { name: 'Suivant' })
  }

  get precedent(): Locator {
    return this.pagination.getByRole('button', { name: 'Précédent' })
  }

  statutSelect(article: Locator): Locator {
    return article.getByRole('combobox', { name: 'Statut' })
  }

  badgeStatut(article: Locator): Locator {
    return article.locator('[data-slot="badge"]')
  }

  async changerStatut(article: Locator, libelle: string): Promise<void> {
    await this.statutSelect(article).click()
    await this.page.getByRole('option', { name: libelle, exact: true }).click()
  }

  toast(texte: string): Locator {
    return this.page.getByText(texte, { exact: true }).first()
  }
}

// --- Clients --------------------------------------------------------------------------------
export class ClientsPage {
  constructor(private readonly page: Page) {}

  goto(query = '') {
    return this.page.goto(`/admin/clients${query}`)
  }

  get filtres(): Locator {
    return this.page.getByRole('search', { name: 'Filtrer les clients' })
  }

  /** Ligne de tableau (>= md) ou élément de liste (< md) contenant ce texte. */
  ligne(texte: string | RegExp): Locator {
    return this.page.getByRole('row').or(this.page.getByRole('listitem')).filter({ hasText: texte })
  }

  get ajouter(): Locator {
    return this.page.getByRole('button', { name: 'Ajouter un client' }).first()
  }

  get dialog(): Locator {
    return this.page.getByRole('dialog')
  }

  get alertDialog(): Locator {
    return this.page.getByRole('alertdialog')
  }

  async choisirDansDialog(label: string, option: string): Promise<void> {
    await this.dialog.getByRole('combobox', { name: label }).click()
    await this.page.getByRole('option', { name: option, exact: true }).click()
  }

  async remplir(valeurs: { site?: string; nom: string; email: string; entreprise?: string }): Promise<void> {
    if (valeurs.site) await this.choisirDansDialog('Site', valeurs.site)
    // Le libellé d'un champ requis porte un « * » (« Nom * ») : correspondance par préfixe.
    await this.dialog.getByLabel(/^Nom/).fill(valeurs.nom)
    if (valeurs.entreprise) await this.dialog.getByLabel('Entreprise').fill(valeurs.entreprise)
    await this.dialog.getByLabel('Courriel').fill(valeurs.email)
  }

  toast(texte: string): Locator {
    return this.page.getByText(texte, { exact: true }).first()
  }
}
