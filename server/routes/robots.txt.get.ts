import { cibleSeo, robotsPublic } from '../lib/seo-hotes'

// robots.txt racine — servi sur l'apex holding (les sous-domaines reçoivent la variante
// `/<slug>/robots.txt` après réécriture edge ; l'admin a la sienne, désindexée).
export default defineEventHandler((event) => {
  const cible = cibleSeo(event)
  if (!cible || cible.slug === 'admin') {
    setHeader(event, 'content-type', 'text/plain; charset=utf-8')
    return 'User-agent: *\nDisallow: /admin\n'
  }
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return robotsPublic(cible)
})
