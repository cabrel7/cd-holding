// URLs des images publiques servies par la passerelle `/api/files/[key]` (jamais de fichier
// statique hors passerelle, CLAUDE.md §Backend). Les dérivés (largeur/format) sont générés à
// la volée côté serveur (sharp) et mis en cache — la liste des largeurs EST le contrat
// entre ce helper, le routeur serveur et le srcset du front (performance lot images).

/** Largeurs de dérivés servies — allowlist partagée client/serveur (clé de cache prévisible). */
export const LARGEURS_DERIVEES = [480, 768, 1024, 1280, 1600] as const

export type LargeurDerivee = (typeof LARGEURS_DERIVEES)[number]

export interface OptionsImage {
  /** Largeur du dérivé (allowlist). Absente → image d'origine convertie de format. */
  readonly largeur?: LargeurDerivee
  /** Format moderne. `webp` par défaut sur le srcset, jamais pour les fichiers privés. */
  readonly format?: 'webp'
}

function query(options: OptionsImage): string {
  const params = new URLSearchParams()
  if (options.format) params.set('f', options.format)
  if (options.largeur) params.set('w', String(options.largeur))
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/** URL d'une image publique, éventuellement dérivée (largeur/format). */
export function urlImage(fileKey: string, options: OptionsImage = {}): string {
  return `/api/files/${fileKey}${query(options)}`
}

/**
 * Attribut `srcset` responsive : toutes les largeurs de l'allowlist au format WebP.
 * À associer à un attribut `sizes` explicite (sinon le navigateur vise 100vw par défaut).
 */
export function srcsetImage(fileKey: string): string {
  return LARGEURS_DERIVEES.map((largeur) => `${urlImage(fileKey, { largeur, format: 'webp' })} ${largeur}w`).join(', ')
}

/** `srcset` borné à une largeur maximale (avatars, vignettes) — une seule variante. */
export function srcsetImageMax(fileKey: string, largeurMax: LargeurDerivee): string {
  const largeurs = LARGEURS_DERIVEES.filter((largeur) => largeur <= largeurMax)
  const retenu = largeurs.at(-1) ?? LARGEURS_DERIVEES[0]
  return urlImage(fileKey, { largeur: retenu, format: 'webp' })
}
