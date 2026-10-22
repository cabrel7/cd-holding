import { cibleSeo, ROBOTS_ADMIN, robotsPublic } from '../lib/seo-hotes'

// robots.txt racine — servi sur l'apex holding (les sous-domaines reçoivent la variante
// `/<slug>/robots.txt` après réécriture edge). Sur l'hôte admin, la route nue sert aussi
// (pas de réécriture edge pour /robots.txt) → désindexation complète.
export default defineEventHandler((event) => {
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  const cible = cibleSeo(event)
  if (!cible) return 'User-agent: *\nAllow: /\n'
  if (cible.slug === 'admin') return ROBOTS_ADMIN
  return robotsPublic(cible)
})
