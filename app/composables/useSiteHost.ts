import { parseSiteHost, type SiteHost } from '#shared/config/site-hosts'

/**
 * Hôte courant (spec lot 8, D1) : résolu via `useRequestURL` — fonctionne côté serveur
 * (URL de la requête) et côté client (location). Le mode chemin/sous-domaine de toute
 * l'UI découle de ce composable.
 */
export function useSiteHost(): ComputedRef<SiteHost> {
  const url = useRequestURL()
  return computed<SiteHost>(() => parseSiteHost(url.host))
}
