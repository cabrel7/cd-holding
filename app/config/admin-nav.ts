// Navigation de la console admin. Seules les routes réellement converties y figurent (pas de
// façade) : le lot 5 ajoutera Planning, Comptabilité, Placement, Réservations, Filiales, etc.
import type { Component } from 'vue'
import { Contact, FileText, LayoutDashboard, Mail } from '@lucide/vue'
import type { ModuleKey } from '#shared/config/modules'
import { ROLES, type AppRole } from '#shared/utils/roles'

export const ADMIN_GROUP_NAME = 'Groupe CD'

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
}

const TOUS_ROLES: readonly AppRole[] = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE, ROLES.EMPLOYE]
const ROLES_GESTION: readonly AppRole[] = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE]

export const ADMIN_NAV: readonly AdminNavItem[] = [
  { to: '/admin', label: 'Tableau de bord', icon: LayoutDashboard, roles: TOUS_ROLES, exact: true },
  { to: '/admin/messages', label: 'Messages', icon: Mail, roles: ROLES_GESTION, compteur: 'messagesNouveaux' },
  { to: '/admin/clients', label: 'Clients', icon: Contact, roles: ROLES_GESTION },
  {
    to: '/admin/contenu',
    label: 'Contenu des sites',
    labelParRole: { [ROLES.ADMIN_FILIALE]: 'Contenu de mon site' },
    icon: FileText,
    roles: ROLES_GESTION,
  },
]

export function isNavItemActive(item: AdminNavItem, path: string): boolean {
  return item.exact ? path === item.to : path === item.to || path.startsWith(`${item.to}/`)
}

export function navLabel(item: AdminNavItem, role: AppRole): string {
  return item.labelParRole?.[role] ?? item.label
}

/** Items visibles pour un rôle et l'ensemble de modules activés sur les sites accessibles. */
export function visibleNavItems(role: AppRole, modules: ReadonlySet<ModuleKey>): readonly AdminNavItem[] {
  return ADMIN_NAV.filter((item) => item.roles.includes(role) && (!item.module || modules.has(item.module)))
}
