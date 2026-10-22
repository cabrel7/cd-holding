import { describe, expect, it } from 'vitest'
import { isNavItemActive, navLabel, visibleNavItems, ADMIN_NAV } from '../../app/config/admin-nav'
import { MODULES, type ModuleKey } from '../../shared/config/modules'
import { ROLES } from '../../shared/utils/roles'
import { adminHref } from '../../shared/utils/site-links'

const AUCUN_MODULE = new Set<never>()
const TOUS_MODULES: ReadonlySet<ModuleKey> = new Set(Object.values(MODULES))
const TOUS_SITES = new Set(['entretien', 'transport', 'comptable', 'placement', 'cdpaa', 'boissons'] as const)

describe('admin-nav', () => {
  it("EMPLOYE ne voit que mon planning et les paramètres (le tableau de bord est redirigé, item masqué)", () => {
    expect(visibleNavItems(ROLES.EMPLOYE, AUCUN_MODULE).map((i) => i.to)).toEqual(['/admin/mon-planning', '/admin/parametres'])
  })

  it("SUPER_ADMIN sans module ne voit que les entrées transversales, Utilisateurs juste avant Paramètres", () => {
    const tos = visibleNavItems(ROLES.SUPER_ADMIN, AUCUN_MODULE).map((i) => i.to)
    expect(tos).toEqual(['/admin', '/admin/messages', '/admin/clients', '/admin/contenu', '/admin/utilisateurs', '/admin/parametres'])
    expect(tos.indexOf('/admin/utilisateurs')).toBeLessThan(tos.indexOf('/admin/parametres'))
  })

  it("ADMIN_FILIALE sans module ne voit que les entrées transversales, sans Utilisateurs (SA seul)", () => {
    expect(visibleNavItems(ROLES.ADMIN_FILIALE, AUCUN_MODULE).map((i) => i.to)).toEqual([
      '/admin',
      '/admin/messages',
      '/admin/clients',
      '/admin/contenu',
      '/admin/parametres',
    ])
  })

  it('item Utilisateurs : SA seul, transversal (ni module ni site), Paramètres toujours dernier', () => {
    const item = ADMIN_NAV.find((i) => i.to === '/admin/utilisateurs')!
    expect(item.label).toBe('Utilisateurs')
    expect(item.roles).toEqual([ROLES.SUPER_ADMIN])
    expect(item.module).toBeUndefined()
    expect(item.site).toBeUndefined()
    expect(ADMIN_NAV.at(-1)?.to).toBe('/admin/parametres')
    expect(ADMIN_NAV.indexOf(item)).toBeLessThan(ADMIN_NAV.findIndex((i) => i.to === '/admin/parametres'))
  })

  it('parametres : visible pour les 3 rôles, transversal (ni module ni site), dernier de la nav', () => {
    const item = ADMIN_NAV.find((i) => i.to === '/admin/parametres')!
    expect(item.label).toBe('Paramètres')
    expect(item.roles).toEqual([ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE, ROLES.EMPLOYE])
    expect(item.module).toBeUndefined()
    expect(item.site).toBeUndefined()
    expect(ADMIN_NAV.at(-1)?.to).toBe('/admin/parametres')
  })

  it('SUPER_ADMIN avec tous les modules voit les 3 plannings (sites distincts) + réservations + placement + dossiers', () => {
    const items = visibleNavItems(ROLES.SUPER_ADMIN, TOUS_MODULES, TOUS_SITES).map((i) => i.to)
    expect(items).toContain('/admin/entretien/planning')
    expect(items).toContain('/admin/transport/planning')
    expect(items).toContain('/admin/cdpaa/planning')
    expect(items).toContain('/admin/cdpaa/reservations')
    expect(items).toContain('/admin/placement')
    expect(items).toContain('/admin/comptable/dossiers')
    expect(items).not.toContain('/admin/mon-planning')
  })

  it('ADMIN_FILIALE entretien ne voit que le planning de sa filiale (sites restreints)', () => {
    // La sidebar dérive les modules des sites accessibles (AdminSidebar.vue:29) : pour
    // l'entretien, modules = {planning} — Réservations n'est jamais visible.
    const items = visibleNavItems(ROLES.ADMIN_FILIALE, new Set([MODULES.PLANNING] as const), new Set(['entretien'] as const)).map((i) => i.to)
    expect(items).toContain('/admin/entretien/planning')
    expect(items).not.toContain('/admin/transport/planning')
    expect(items).not.toContain('/admin/cdpaa/planning')
    expect(items).not.toContain('/admin/cdpaa/reservations')
    expect(items).not.toContain('/admin/placement')
  })

  it('libellés planning distincts par site (3 libellés identiques adjacents = inutilisable)', () => {
    expect(ADMIN_NAV.find((i) => i.to === '/admin/entretien/planning')!.label).toBe('Planning — Entretien')
    expect(ADMIN_NAV.find((i) => i.to === '/admin/transport/planning')!.label).toBe('Planning — Transport')
    expect(ADMIN_NAV.find((i) => i.to === '/admin/cdpaa/planning')!.label).toBe('Planning — CDPAA')
  })

  it('libellé du contenu selon le rôle', () => {
    const contenu = ADMIN_NAV.find((i) => i.to === '/admin/contenu')!
    expect(navLabel(contenu, ROLES.SUPER_ADMIN)).toBe('Contenu des sites')
    expect(navLabel(contenu, ROLES.ADMIN_FILIALE)).toBe('Contenu de mon site')
  })

  it("le tableau de bord n'est actif que sur le chemin exact", () => {
    const [accueil, messages] = ADMIN_NAV
    expect(isNavItemActive(accueil!, '/admin')).toBe(true)
    expect(isNavItemActive(accueil!, '/admin/messages')).toBe(false)
    expect(isNavItemActive(messages!, '/admin/messages')).toBe(true)
    expect(isNavItemActive(messages!, '/admin/messagesx')).toBe(false)
  })

  // Rendu adminHref (D8) : AdminSidebar/AdminHeader traduisent item.to et le path courant
  // via la forme servie — l'actif doit rester juste des deux côtés, nu (SPA sur admin.) comme
  // préfixé (chargement complet).
  it('actif homogène après traduction adminHref (forme nue servie)', () => {
    const traduit = (to: string) => ({ ...ADMIN_NAV.find((i) => i.to === to)!, to: adminHref(to, true) })
    const messages = traduit('/admin/messages')
    const accueil = traduit('/admin')

    expect(isNavItemActive(messages, adminHref('/admin/messages', true))).toBe(true)
    expect(isNavItemActive(messages, '/messages/123')).toBe(true)
    expect(isNavItemActive(messages, '/clients')).toBe(false)

    expect(isNavItemActive(accueil, adminHref('/admin', true))).toBe(true)
    expect(isNavItemActive(accueil, '/')).toBe(true)
    expect(isNavItemActive(accueil, '/messages')).toBe(false)
  })

  it('actif homogène sans traduction (mode chemin, préfixé des deux côtés)', () => {
    const messages = ADMIN_NAV.find((i) => i.to === '/admin/messages')!
    expect(isNavItemActive(messages, adminHref('/admin/messages', false))).toBe(true)
    expect(isNavItemActive(messages, adminHref('/admin', false))).toBe(false)
  })
})
