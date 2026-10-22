import { getHeader } from 'h3'
import { parseSiteHost } from '#shared/config/site-hosts'
import { HOLDING_SLUG } from '#shared/config/sites'
import { sitemapPublic, type CibleSeo } from '../../lib/seo-hotes'

// sitemap.xml d'un sous-domaine — même contrat que `robots.txt` : le chemin préfixé n'est
// servi que sur SON hôte (sinon 404, jamais un sitemap qui désigne le mauvais site).
export default defineEventHandler((event) => {
  const slug = event.context.params?.slug
  const hote = (getHeader(event, 'host') ?? '').trim().toLowerCase().split(':')[0] ?? ''
  const { slug: cibleHote, hoteConnu } = parseSiteHost(hote)

  if (!slug || slug !== cibleHote || slug === 'admin' || slug === HOLDING_SLUG) {
    throw createError({ statusCode: 404, statusMessage: 'Introuvable' })
  }

  const cible: CibleSeo = { slug: slug as Exclude<CibleSeo['slug'], 'admin'>, hoteConnu, base: `https://${hote}` }
  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  return sitemapPublic(cible)
})
