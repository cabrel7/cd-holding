import { cibleSeo, sitemapPublic } from '../lib/seo-hotes'

// sitemap.xml racine — variante apex (holding) ; les sous-domaines reçoivent la variante
// `/<slug>/sitemap.xml`. Host admin → 404 (rien à indexer).
export default defineEventHandler((event) => {
  const cible = cibleSeo(event)
  if (!cible) throw createError({ statusCode: 404, statusMessage: 'Introuvable' })
  if (cible.slug === 'admin') throw createError({ statusCode: 404, statusMessage: 'Introuvable' })
  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  return sitemapPublic(cible)
})
