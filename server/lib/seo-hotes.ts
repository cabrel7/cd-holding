import { getHeader, type H3Event } from 'h3'
import { parseSiteHost } from '#shared/config/site-hosts'
import { HOLDING_SLUG, publicNav, type SiteSlug } from '#shared/config/sites'

// SEO par hôte (lot SEO/GEO) : robots.txt et sitemap.xml servis différemment selon le
// sous-domaine — un seul build Nitro, la résolution se fait sur l'en-tête Host (l'edge
// réécrit les chemins nus en `/<slug>/…`, d'où les variantes de routes dedans).

export type CibleSeo = { readonly slug: SiteSlug | 'admin'; readonly hoteConnu: boolean; readonly base: string }

/** Hôte public sans port, en minuscules. */
function hoteCourant(event: H3Event): string {
  return (getHeader(event, 'host') ?? '').trim().toLowerCase().split(':')[0] ?? ''
}

/**
 * Site visé par la requête courante. `hoteConnu=false` (dev, e2e `*.localhost`) → pas
 * d'URL absolue émise dans robots/sitemap. L'admin a sa propre cible (désindexé).
 */
export function cibleSeo(event: H3Event): CibleSeo | null {
  const hote = hoteCourant(event)
  if (!hote) return null
  const { slug, hoteConnu } = parseSiteHost(hote)
  const base = `https://${hote}`
  if (slug === 'admin') return { slug: 'admin', hoteConnu, base }
  if (slug && hoteConnu) return { slug, hoteConnu, base }
  return { slug: HOLDING_SLUG, hoteConnu: false, base }
}

/** Chemins publics d'un site, SANS préfixe de site ni fragment (URLs nu es servies sur le sous-domaine). */
export function cheminsDuSite(slug: SiteSlug): readonly string[] {
  const prefixe = slug === HOLDING_SLUG ? '' : `/${slug}`
  const nav = publicNav(slug).map((item) => {
    const chemin = item.to.split('#')[0] ?? ''
    if (!prefixe || !chemin.startsWith(prefixe)) return chemin
    return chemin.slice(prefixe.length) || '/'
  })
  const horsNav = slug === HOLDING_SLUG ? ['/confidentialite'] : ['/mentions-legales']
  return [...new Set([...nav, ...horsNav])]
}

/** Corps robots.txt pour l'admin : tout est désindexé. */
export const ROBOTS_ADMIN = 'User-agent: *\nDisallow: /\n'

/** Corps robots.txt d'un site public connu (+ sitemap) ou générique en dev. */
export function robotsPublic(cible: CibleSeo): string {
  if (!cible.hoteConnu) return 'User-agent: *\nAllow: /\n'
  return `User-agent: *\nAllow: /\n\nSitemap: ${cible.base}/sitemap.xml\n`
}

/** Corps sitemap.xml (urlset) d'un site — URLs absolues identiques à la canonical. */
export function sitemapPublic(cible: CibleSeo): string {
  const urls = cheminsDuSite(cible.slug as SiteSlug)
    .map((chemin) => `  <url><loc>${cible.base}${chemin === '/' ? '/' : chemin}</loc></url>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}
