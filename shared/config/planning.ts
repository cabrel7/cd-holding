// Constantes du module planning (lot 5). Imports relatifs : importable par tsx et le serveur.
import type { SiteSlug } from './sites'

/** Filiales portant le module planning — miroir de SITE_MODULES (source : modules.ts). */
export const PLANNING_SITES = ['entretien', 'transport', 'cdpaa'] as const satisfies readonly SiteSlug[]

export type PlanningSite = (typeof PLANNING_SITES)[number]

/** Libellés des 7 jours, lundi → dimanche (grille planning). */
export const JOURS_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'] as const
