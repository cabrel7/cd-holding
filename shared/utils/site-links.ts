import { FILIALE_SLUGS, HOLDING_SLUG, type SiteSlug } from '../config/sites'
import { hoteDeSlug, parseSiteHost, type SiteHostTarget, type SiteMode } from '../config/site-hosts'

// Helpers purs de liens (spec lot 8, D7/D9) — aucun accès Nuxt : testables en unitaire pur,
// le contexte (mode hôte, slug résolu, origine) est injecté par le composable useSiteLinks.

export interface ContexteSite {
  readonly mode: SiteMode
  // Slug du site que sert l'hôte courant (holding sur apex compris), undefined si hôte inconnu.
  readonly hote?: SiteHostTarget
  readonly hoteConnu: boolean
  // Origine de la requête (ex. https://chauvierdelor.com) — jamais de domaine codé en dur.
  readonly origine?: string
}

export interface LienSite {
  readonly to: string
  readonly externe: boolean
}

// Pages servies sans préfixe de site sur TOUS les hôtes (même racine à l'apex, sur les
// sous-domaines et en dev) : liste maintenue explicitement, une entrée = une décision.
const CHEMINS_PARTAGES = new Set(['/confidentialite'])

function avecHash(chemin: string, hash?: string): string {
  if (!hash) return chemin
  return hash.startsWith('#') ? `${chemin}${hash}` : `${chemin}#${hash}`
}

/** Retire le préfixe de site d'un chemin (`/entretien/contact` → `/contact`, holding : identité). */
export function cheminRelatif(slug: SiteSlug, chemin: string): string {
  const prefixe = `/${slug}`
  if (chemin === prefixe) return '/'
  if (chemin.startsWith(`${prefixe}/`)) return chemin.slice(prefixe.length)
  return chemin
}

function cheminPrefixe(slug: SiteSlug, chemin: string): string {
  if (slug === HOLDING_SLUG) return chemin
  return `/${slug}${chemin === '/' ? '' : chemin}`
}

// URL absolue vers l'hôte cible : l'hôte vient du registre SITE_HOSTS (via hoteDeSlug),
// le schéma de l'origine courante — jamais de domaine codé en dur dans ce helper.
function absolueVers(origine: string, cible: SiteHostTarget, chemin: string): string {
  const base = new URL(origine)
  const hoteCible = hoteDeSlug(cible)
  if (hoteCible) base.host = hoteCible
  return `${base.origin}${chemin}`
}

/**
 * Construit le lien vers une page d'un site public (spec lot 8, D7).
 * - chemin partagé → identique partout ;
 * - même site que l'hôte → nu en mode sous-domaine, préfixé en mode chemin ;
 * - site différent → absolu (prod connue) ou préfixé relatif (dev) pour rester SPA.
 */
export function siteHref(
  ctx: ContexteSite,
  slugCible: SiteHostTarget,
  chemin: string,
  hash?: string,
): LienSite {
  const propre = chemin.startsWith('/') ? chemin : `/${chemin}`

  if (CHEMINS_PARTAGES.has(propre)) {
    return { to: avecHash(propre, hash), externe: false }
  }

  // L'admin a sa propre grammaire (D8) : nu sur admin.chauvierdelor.com, absolue depuis
  // un autre site connu, préfixé /admin en dev.
  if (slugCible === 'admin') {
    const nu = adminHref(propre, true)
    if (ctx.hote === 'admin') return { to: avecHash(nu, hash), externe: false }
    if (ctx.hoteConnu && ctx.origine) {
      return { to: avecHash(absolueVers(ctx.origine, 'admin', nu), hash), externe: true }
    }
    return { to: avecHash(propre, hash), externe: false }
  }

  const memeSite = ctx.hote !== undefined && ctx.hote === slugCible
  if (memeSite) {
    const to = ctx.mode === 'sous-domaine' ? propre : cheminPrefixe(slugCible, propre)
    return { to: avecHash(to, hash), externe: false }
  }

  if (ctx.hoteConnu && ctx.origine) {
    return { to: avecHash(absolueVers(ctx.origine, slugCible, propre), hash), externe: true }
  }

  return { to: avecHash(cheminPrefixe(slugCible, propre), hash), externe: false }
}

/**
 * URL absolue vers une page (canonical, JSON-LD) — chemin **nu** sur l'hôte cible : c'est la
 * forme canonique du sous-domaine, elle coïncide donc avec `canonicalPath` (spec D9).
 * À n'émettre que si l'hôte est connu (prod) — garni en dev, le registre SITE_HOSTS
 * fournirait un FQDN qui n'est pas servi.
 */
export function siteAbsoluteUrl(origine: string, slugCible: SiteSlug, chemin = '/'): string {
  const propre = chemin.startsWith('/') ? chemin : `/${chemin}`
  return absolueVers(origine, slugCible, propre)
}

/**
 * Lien de l'UI d'administration : le prompt reste `/admin/...` (sécurité, docs),
 * la traduction en chemins nus n'a lieu que sur admin.chauvierdelor.com (D8).
 */
export function adminHref(path: string, hoteAdmin: boolean): string {
  const propre = path.startsWith('/') ? path : `/${path}`
  if (!hoteAdmin) return propre
  if (propre === '/admin') return '/'
  if (propre.startsWith('/admin/')) return propre.slice('/admin'.length)
  return propre
}

/**
 * Canonical (D9) : null en dev (hôte inconnu), forme nu sur sous-domaine connu,
 * forme à l'identique sur l'apex. `chemin` = route.path (préfixé côté serveur en prod).
 */
export function canonicalPath(chemin: string, ctx: ContexteSite): string | null {
  if (!ctx.hoteConnu || !ctx.hote) return null
  if (ctx.mode === 'sous-domaine' && ctx.hote !== 'admin' && ctx.hote !== HOLDING_SLUG) {
    const prefixe = `/${ctx.hote}`
    if (chemin === prefixe) return '/'
    if (chemin.startsWith(`${prefixe}/`)) return chemin.slice(prefixe.length) || '/'
  }
  return chemin
}

/**
 * Redirections 301 canoniques (D5) — null = laisser passer. Uniquement hôtes connus (prod).
 * - admin : `/admin/...` → nu ;
 * - holding/apex/www : `/<filiale>/...` et `/admin/...` → sous-domaine cible (URL absolue) ;
 * - filiale : son propre préfixe éventuel → nu (garde anti-boucle), reste → 404 router.
 */
export function cibleRedirection(host: string, chemin: string, origine?: string): string | null {
  const site = parseSiteHost(host)
  const { slug, hoteConnu } = site
  if (!hoteConnu || !slug) return null

  const sansParam = chemin.split('?')[0] ?? chemin
  // Query conservée sur TOUTES les branches (revue m1), y compris les égalités exactes.
  const query = chemin.includes('?') ? chemin.slice(chemin.indexOf('?')) : ''

  if (slug === 'admin') {
    if (sansParam === '/admin') return `/${query}`
    if (sansParam.startsWith('/admin/')) return `${sansParam.slice('/admin'.length)}${query}`
    return null
  }

  if (slug === HOLDING_SLUG) {
    const segment = sansParam.split('/')[1] ?? ''
    const cible: SiteHostTarget | undefined =
      segment === 'admin' ? 'admin' : (FILIALE_SLUGS.find((f) => f === segment) as SiteSlug | undefined)
    if (!cible || !origine) return null
    const hoteCible = hoteDeSlug(cible)
    if (!hoteCible) return null
    const base = new URL(origine)
    base.host = hoteCible
    const reste = sansParam.slice(1 + segment.length) || '/'
    return `${base.origin}${reste}${query}`
  }

  const prefixe = `/${slug}`
  if (sansParam === prefixe) return `/${query}`
  if (sansParam.startsWith(`${prefixe}/`)) {
    return `${sansParam.slice(prefixe.length)}${query}`
  }
  return null
}
