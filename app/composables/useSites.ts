import type { PublicSiteSummary } from '#shared/types/public'

/**
 * Liste des filiales publiques, triées par ordre — GET /api/public/sites (spec §4.2).
 * Sert le pied de page holding (`SiteFooter`, liste « Nos filiales ») et l'accueil holding.
 */
export function useSites() {
  return useFetch<PublicSiteSummary[]>('/api/public/sites', { key: 'sites' })
}
