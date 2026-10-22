import { HOLDING_SLUG, type SiteSlug } from './sites'

// Source unique de la correspondance hôte → site (spec lot 8, D1). Consommé par le serveur
// (redirections 301), le front (mode chemin/sous-domaine) et les tests — jamais de domaine
// codé en dur ailleurs que dans ce fichier.
export type SiteHostTarget = SiteSlug | 'admin'

export type SiteMode = 'chemin' | 'sous-domaine'

export interface SiteHost {
  // Mode « sous-domaine » = chemins nus servis pour le site résolu (filiale ou admin).
  // Le holding sur l'apex reste en mode chemin (sa racine `/` EST son chemin).
  readonly mode: SiteMode
  readonly slug?: SiteHostTarget
  // Hôte listé ci-dessous (FQDN de prod) — distingue la prod de dev/IP (`*.localhost`
  // résout le slug mais reste non connu : liens inter-sites relatifs, pas de canonical).
  readonly hoteConnu: boolean
}

export const SITE_HOSTS: Record<string, SiteHostTarget> = {
  'chauvierdelor.com': HOLDING_SLUG,
  'www.chauvierdelor.com': HOLDING_SLUG,
  'entretien.chauvierdelor.com': 'entretien',
  'transport.chauvierdelor.com': 'transport',
  'comptable.chauvierdelor.com': 'comptable',
  'placement.chauvierdelor.com': 'placement',
  'ccdpaa.chauvierdelor.com': 'ccdpaa',
  'boissons.chauvierdelor.com': 'boissons',
  'admin.chauvierdelor.com': 'admin',
}

const SUFFIXE_TEST = '.localhost'

function sansPort(host: string): string {
  return host.trim().toLowerCase().split(':')[0] ?? ''
}

/** FQDN de prod correspondant à un slug (holding → apex) — pour générer des URLs absolues. */
export function hoteDeSlug(slug: SiteHostTarget): string | undefined {
  for (const [hote, cible] of Object.entries(SITE_HOSTS)) {
    if (cible === slug && !hote.startsWith('www.')) return hote
  }
  return undefined
}

/** Mode de service de l'hôte : résout le slug (prod, `*.localhost` de test) ou tombe en chemin. */
export function parseSiteHost(host: string): SiteHost {
  const hote = sansPort(host)

  const direct = SITE_HOSTS[hote]
  if (direct) {
    return {
      mode: direct === HOLDING_SLUG ? 'chemin' : 'sous-domaine',
      slug: direct,
      hoteConnu: true,
    }
  }

  // e2e : `<slug>.localhost` (Chromium/Firefox résolvent *.localhost) → même cible que prod,
  // mais hôte non connu (pas d'URL absolue, pas de canonical en dev).
  if (hote.endsWith(SUFFIXE_TEST)) {
    const candidate = hote.slice(0, -SUFFIXE_TEST.length)
    const cible = SITE_HOSTS[candidate] ?? SITE_HOSTS[`${candidate}.chauvierdelor.com`]
    if (cible) {
      return { mode: cible === HOLDING_SLUG ? 'chemin' : 'sous-domaine', slug: cible, hoteConnu: false }
    }
  }

  return { mode: 'chemin', hoteConnu: false }
}
