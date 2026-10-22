import type { SiteSlug } from './sites'

// Modules métier optionnels, activés par filiale. Consommé par `server/utils/site-scope.ts`
// (T1, `requireModule`) pour renvoyer 403 quand une route de module n'est pas pertinente
// pour la filiale visée (ex. `/admin/comptable/dossiers` pour la filiale `entretien`).
export const MODULES = {
  PLANNING: 'planning',
  COMPTABLE: 'comptable',
  PLACEMENT: 'placement',
  RESERVATIONS: 'reservations',
} as const

export type ModuleKey = (typeof MODULES)[keyof typeof MODULES]

export const SITE_MODULES: Record<SiteSlug, readonly ModuleKey[]> = {
  holding: [],
  entretien: [MODULES.PLANNING],
  transport: [MODULES.PLANNING],
  comptable: [MODULES.COMPTABLE],
  placement: [MODULES.PLACEMENT],
  cdpaa: [MODULES.PLANNING, MODULES.RESERVATIONS],
  boissons: [],
}

export function siteHasModule(slug: SiteSlug, module: ModuleKey): boolean {
  return SITE_MODULES[slug].includes(module)
}
