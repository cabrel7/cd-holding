// Conventions de texte éditorial du catalogue de sections (spec phase 2 §1.4) :
// - `*accent*` délimite un segment à accentuer (italique, poids moyen), jamais rendu via
//   v-html — le composant TexteAccentue (T3) consomme les segments produits ici.
// - `\n` produit un retour à la ligne.
// - `{groupe}`, `{nomCourt}`, `{nom}` sont interpolées depuis une liste blanche ; une variable
//   inconnue (ex. `{inconnue}`) est laissée telle quelle plutôt que supprimée silencieusement.
export interface TexteVars {
  groupe?: string
  nomCourt?: string
  nom?: string
}

const VARIABLE_PATTERN = /\{(groupe|nomCourt|nom)\}/g

export function interpoler(texte: string, vars: TexteVars = {}): string {
  return texte.replace(VARIABLE_PATTERN, (correspondance, cle: keyof TexteVars) => {
    const valeur = vars[cle]
    return valeur !== undefined && valeur !== '' ? valeur : correspondance
  })
}

/**
 * Fusionne les variables par défaut du site courant avec des variables explicites d'appelant
 * (celles-ci gagnent). Utilisé par `TexteAccentue` (T3) pour interpoler tout texte public sans
 * que chaque site consommateur ait à repasser `{groupe}`/`{nomCourt}`/`{nom}` explicitement.
 */
export function mergerVars(base: TexteVars, overrides?: TexteVars): TexteVars {
  // Une variable explicite absente (`undefined`) ne doit pas effacer la valeur du site.
  const definies = Object.entries(overrides ?? {}).filter(([, valeur]) => valeur !== undefined)
  return { ...base, ...Object.fromEntries(definies) }
}

export type TexteSegment =
  | { type: 'texte'; valeur: string }
  | { type: 'accent'; valeur: string }
  | { type: 'saut' }

const ACCENT_PATTERN = /\*([^*]+)\*/g

/** Découpe un texte déjà interpolé en segments texte / accent / saut de ligne. */
export function segmenterTexteAccentue(texteInterpole: string): TexteSegment[] {
  const segments: TexteSegment[] = []
  const lignes = texteInterpole.split('\n')

  lignes.forEach((ligne, index) => {
    let curseur = 0
    ACCENT_PATTERN.lastIndex = 0
    let correspondance: RegExpExecArray | null
    // eslint-disable-next-line no-cond-assign
    while ((correspondance = ACCENT_PATTERN.exec(ligne))) {
      if (correspondance.index > curseur) {
        segments.push({ type: 'texte', valeur: ligne.slice(curseur, correspondance.index) })
      }
      segments.push({ type: 'accent', valeur: correspondance[1] ?? '' })
      curseur = ACCENT_PATTERN.lastIndex
    }
    if (curseur < ligne.length) {
      segments.push({ type: 'texte', valeur: ligne.slice(curseur) })
    }
    if (index < lignes.length - 1) {
      segments.push({ type: 'saut' })
    }
  })

  return segments
}

/** Interpole puis segmente — fonction unique consommée par TexteAccentue (T3). */
export function texteAccentueSegments(texte: string, vars: TexteVars = {}): TexteSegment[] {
  return segmenterTexteAccentue(interpoler(texte, vars))
}
