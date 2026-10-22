import type { SiteSlug } from '#shared/config/sites'
import {
  adminHref,
  cibleRedirection,
  canonicalPath,
  siteAbsoluteUrl,
  siteHref,
  type ContexteSite,
  type LienSite,
} from '#shared/utils/site-links'

/**
 * Pont entre les helpers purs de `shared/utils/site-links` et Nuxt (spec lot 8, D7) :
 * assemble le contexte (hôte, origine) une seule fois pour les composants.
 */
export function useSiteLinks(): {
  href: (slug: SiteSlug, chemin: string, hash?: string) => LienSite
  admin: (path: string) => string
  canonical: (chemin: string) => string | null
  absolute: (slug: SiteSlug, chemin?: string) => string | null
  redirection: (chemin: string) => string | null
} {
  const host = useSiteHost()
  const url = useRequestURL()

  const contexte = (): ContexteSite => ({
    mode: host.value.mode,
    hote: host.value.slug,
    hoteConnu: host.value.hoteConnu,
    origine: url.origin,
  })

  return {
    href: (slug, chemin, hash) => siteHref(contexte(), slug, chemin, hash),
    admin: (path) => adminHref(path, host.value.slug === 'admin'),
    canonical: (chemin) => canonicalPath(chemin, contexte()),
    absolute: (slug, chemin = '/') => siteAbsoluteUrl(url.origin, slug, chemin),
    redirection: (chemin) => cibleRedirection(url.host, chemin, url.origin),
  }
}
