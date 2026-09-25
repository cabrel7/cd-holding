import { z } from 'zod'

// Source unique de la liste des sites publics — importée par nuxt.config.ts (chemin relatif,
// voir commentaire dans ce fichier), le layout (T3), le CMS (T4) et le seed (T2).
export const HOLDING_SLUG = 'holding' as const

export const FILIALE_SLUGS = ['entretien', 'transport', 'comptable', 'placement', 'ccdpaa', 'boissons'] as const

export const SITE_SLUGS = [HOLDING_SLUG, ...FILIALE_SLUGS] as const

export type FilialeSlug = (typeof FILIALE_SLUGS)[number]
export type SiteSlug = (typeof SITE_SLUGS)[number]

export const siteSlugSchema = z.enum(SITE_SLUGS)

export function isFilialeSlug(value: string): value is FilialeSlug {
  return (FILIALE_SLUGS as readonly string[]).includes(value)
}

export function isSiteSlug(value: string): value is SiteSlug {
  return (SITE_SLUGS as readonly string[]).includes(value)
}

// Pages supplémentaires (au-delà du socle commun services/réalisations/à-propos/contact)
// propres à certaines filiales. Consommé par le routage `[filiale]/*` et par la nav.
export const SITE_EXTRA_PAGES: Partial<Record<FilialeSlug, readonly string[]>> = {
  ccdpaa: ['restaurant'],
  placement: ['offres'],
}

export interface NavItem {
  readonly label: string
  readonly to: string
  readonly hash?: string
}

/**
 * Navigation publique d'un site. Les libellés sont de l'UI (donc en code, pas en CMS) —
 * voir spec phase 2 §4.1. L'ancre `/#filiales` de la holding est une exception documentée
 * à la règle « pas d'ancre » (point ouvert #12) : elle vise la structure de la page d'accueil
 * de la holding, qui n'a pas de page dédiée pour la liste des filiales.
 */
/** Chemin de la page contact d'un site : `/contact` (holding) ou `/<filiale>/contact`. */
export function contactPath(slug: SiteSlug): string {
  return slug === HOLDING_SLUG ? '/contact' : `/${slug}/contact`
}

export function publicNav(slug: SiteSlug): readonly NavItem[] {
  if (slug === HOLDING_SLUG) {
    return [
      { label: 'Nos filiales', to: '/', hash: '#filiales' },
      { label: 'Réalisations', to: '/realisations' },
      { label: 'À propos', to: '/a-propos' },
      { label: 'Contact', to: contactPath(HOLDING_SLUG) },
    ]
  }

  const base = `/${slug}`
  const items: NavItem[] = [
    { label: 'Accueil', to: base },
    { label: 'Services', to: `${base}/services` },
  ]
  if (slug === 'ccdpaa') items.push({ label: 'Restaurant', to: `${base}/restaurant` })
  if (slug === 'placement') items.push({ label: 'Offres', to: `${base}/offres` })
  items.push(
    { label: 'Réalisations', to: `${base}/realisations` },
    { label: 'À propos', to: `${base}/a-propos` },
    { label: 'Contact', to: contactPath(slug) },
  )
  return items
}
