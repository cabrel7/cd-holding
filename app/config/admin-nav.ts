// Navigation de la console admin. Seules les routes réellement converties y figurent (pas de
// façade) : modules vivants = Messages, Clients, Contenu, Placement, Réservations, Plannings,
// Mon planning ; plus les transversaux Utilisateurs (super administrateur seul) et Paramètres. Le tableau de bord est réservé aux
// gestionnaires : un EMPLOYE est redirigé vers /admin/mon-planning (middleware admin), l'item
// serait une cible jamais atteignable pour lui.
import type { Component } from 'vue'
import {
  BriefcaseBusiness,
  CalendarCheck,
  CalendarDays,
  Calculator,
  Contact,
  FileText,
  LayoutDashboard,
  Mail,
  Settings,
  Users,
  UtensilsCrossed,
} from '@lucide/vue'
import { MODULES, type ModuleKey } from '#shared/config/modules'
import type { SiteSlug } from '#shared/config/sites'
import { ROLES, type AppRole } from '#shared/utils/roles'

export const ADMIN_GROUP_NAME = 'Groupe CD'

/** Largeur de contenu commune à toutes les pages du shell admin. */
export const ADMIN_PAGE_WIDTH_CLASS = 'mx-auto w-full max-w-7xl'

export type AdminCompteurKey = 'messagesNouveaux'

export interface AdminNavItem {
  readonly to: string
  readonly label: string
  /** Surcharge du libellé selon le rôle (ex. « Contenu des sites » vs « Contenu de mon site »). */
  readonly labelParRole?: Partial<Record<AppRole, string>>
  readonly icon: Component
  readonly roles: readonly AppRole[]
  /** Module requis : l'item n'apparaît que si un site visible l'active. */
  readonly module?: ModuleKey
  readonly compteur?: AdminCompteurKey
  /** Actif uniquement sur le chemin exact (le tableau de bord est le préfixe de toutes les routes). */
  readonly exact?: boolean
  /**
   * Filiale porteuse de l'item (planning : une route scopée par site). Sans `site`, l'item est
   * transversal. Voir `visibleNavItems` : un AF ne voit que l'item de sa filiale.
   */
  readonly site?: SiteSlug
}

const ROLES_GESTION: readonly AppRole[] = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE]

export const ADMIN_NAV: readonly AdminNavItem[] = [
  { to: '/admin', label: 'Tableau de bord', icon: LayoutDashboard, roles: ROLES_GESTION, exact: true },
  { to: '/admin/messages', label: 'Messages', icon: Mail, roles: ROLES_GESTION, compteur: 'messagesNouveaux' },
  { to: '/admin/clients', label: 'Clients', icon: Contact, roles: ROLES_GESTION },
  {
    to: '/admin/contenu',
    label: 'Contenu des sites',
    labelParRole: { [ROLES.ADMIN_FILIALE]: 'Contenu de mon site' },
    icon: FileText,
    roles: ROLES_GESTION,
  },
  { to: '/admin/placement', label: 'Placement', icon: BriefcaseBusiness, roles: ROLES_GESTION, module: MODULES.PLACEMENT },
  { to: '/admin/comptable/dossiers', label: 'Dossiers', icon: Calculator, roles: ROLES_GESTION, module: MODULES.COMPTABLE },
  {
    to: '/admin/ccdpaa/reservations',
    label: 'Réservations',
    icon: UtensilsCrossed,
    roles: ROLES_GESTION,
    module: MODULES.RESERVATIONS,
  },
  {
    to: '/admin/entretien/planning',
    label: 'Planning — Entretien',
    icon: CalendarDays,
    roles: ROLES_GESTION,
    module: MODULES.PLANNING,
    site: 'entretien',
  },
  {
    to: '/admin/transport/planning',
    label: 'Planning — Transport',
    icon: CalendarDays,
    roles: ROLES_GESTION,
    module: MODULES.PLANNING,
    site: 'transport',
  },
  {
    to: '/admin/ccdpaa/planning',
    label: 'Planning — CCDPAA',
    icon: CalendarDays,
    roles: ROLES_GESTION,
    module: MODULES.PLANNING,
    site: 'ccdpaa',
  },
  {
    to: '/admin/mon-planning',
    label: 'Mon planning',
    icon: CalendarCheck,
    roles: [ROLES.EMPLOYE],
  },
  // Transversal (ni module ni site) : la gestion des comptes est une capacité de la console,
  // réservée au super administrateur (lot 6, D2) — l'item est masqué pour les 2 autres rôles.
  { to: '/admin/utilisateurs', label: 'Utilisateurs', icon: Users, roles: [ROLES.SUPER_ADMIN] },
  // Transversal (ni module ni site) : le mot de passe est une capacité de compte, pas une donnée
  // — les 3 rôles y accèdent, dont l'EMPLOYE (D1 : sa seule porte de secours avant D10).
  { to: '/admin/parametres', label: 'Paramètres', icon: Settings, roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE, ROLES.EMPLOYE] },
]

export function isNavItemActive(item: AdminNavItem, path: string): boolean {
  return item.exact ? path === item.to : path === item.to || path.startsWith(`${item.to}/`)
}

export function navLabel(item: AdminNavItem, role: AppRole): string {
  return item.labelParRole?.[role] ?? item.label
}

/**
 * Items visibles pour un rôle et l'ensemble de modules activés sur les sites accessibles.
 * `sites` (slugs des sites accessibles, ex. via `/api/admin/sites`) restreint les items scopés
 * (`item.site`) : un AF ne voit que le planning de sa filiale. Absent (tests), aucun filtrage
 * par site n'est appliqué.
 */
export function visibleNavItems(
  role: AppRole,
  modules: ReadonlySet<ModuleKey>,
  sites?: ReadonlySet<SiteSlug>,
): readonly AdminNavItem[] {
  return ADMIN_NAV.filter(
    (item) =>
      item.roles.includes(role) &&
      (!item.module || modules.has(item.module)) &&
      (!item.site || !sites || sites.has(item.site)),
  )
}
