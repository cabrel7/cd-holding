import { getHeader } from 'h3'
import { parseSiteHost } from '#shared/config/site-hosts'
import { HOLDING_SLUG } from '#shared/config/sites'
import { robotsPublic, type CibleSeo } from '../../lib/seo-hotes'

// robots.txt d'un sous-domaine — l'edge a réécrit `/robots.txt` en `/<slug>/robots.txt`.
export default defineEventHandler((event) => {
  const slug = event.context.params?.slug
  const hote = (getHeader(event, 'host') ?? '').trim().toLowerCase().split(':')[0] ?? ''
  const { slug: cibleHote, hoteConnu } = parseSiteHost(hote)

  // Le chemin préfixé n'a de sens que sur SON sous-domaine : ailleurs (apex, admin)
  // la requête n'existe pas — 404 plutôt qu'un robots qui désigne le mauvais site.
  if (!slug || slug !== cibleHote || slug === 'admin' || slug === HOLDING_SLUG) {
    throw createError({ statusCode: 404, statusMessage: 'Introuvable' })
  }

  const cible: CibleSeo = { slug: slug as Exclude<CibleSeo['slug'], 'admin'>, hoteConnu, base: `https://${hote}` }
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return robotsPublic(cible)
})
