// Formatage des erreurs 5xx pour les logs — pur (testable sans Nitro). CLAUDE.md « logs sans
// donnée personnelle » : une erreur Prisma embarque dans `message` les arguments de l'appel
// (nom, courriel, téléphone du candidat…), et `stack` reprend ce message. On ne journalise donc
// jamais `message` d'une erreur non maîtrisée : seulement son nom de classe et son `code`
// (ex. P2002), plus la route sans query string.

const MAX_PROFONDEUR_CAUSE = 5

interface ErreurLike {
  readonly name?: unknown
  readonly code?: unknown
  readonly message?: unknown
  readonly statusMessage?: unknown
  readonly cause?: unknown
}

export interface ContexteErreurLog {
  readonly statusCode: number
  readonly method?: string
  readonly path?: string
  readonly erreur: string
  readonly code?: string
  readonly message?: string
}

/** Retire la query string d'un chemin (token, courriel passés par erreur en paramètre d'URL). */
export function cheminSansQuery(path: string | undefined): string | undefined {
  if (!path) return path
  const index = path.indexOf('?')
  return index === -1 ? path : path.slice(0, index)
}

const estObjet = (value: unknown): value is ErreurLike => typeof value === 'object' && value !== null

/** Cause racine (bornée, protégée contre les cycles). */
function causeRacine(erreur: ErreurLike): ErreurLike {
  let courante = erreur
  for (let i = 0; i < MAX_PROFONDEUR_CAUSE && estObjet(courante.cause) && courante.cause !== courante; i++) {
    courante = courante.cause
  }
  return courante
}

/**
 * `message` n'est repris que pour une erreur H3 volontaire : `statusMessage` non vide, identique
 * au message, et aucune cause sous-jacente (un `createError` maison sans `cause`). Tout le reste
 * (erreur Prisma, TypeError, H3Error enveloppant une cause) → nom de classe + code seulement.
 */
export function formaterErreurPourLog(
  erreur: unknown,
  requete: { statusCode: number; method?: string; path?: string },
): ContexteErreurLog {
  const contexte = { statusCode: requete.statusCode, method: requete.method, path: cheminSansQuery(requete.path) }
  if (!estObjet(erreur)) return { ...contexte, erreur: 'ErreurInconnue' }

  const racine = causeRacine(erreur)
  const nom = typeof racine.name === 'string' && racine.name ? racine.name : 'Error'
  const code = typeof racine.code === 'string' || typeof racine.code === 'number' ? String(racine.code) : undefined

  const maitrisee =
    typeof erreur.statusMessage === 'string' &&
    erreur.statusMessage !== '' &&
    erreur.message === erreur.statusMessage &&
    erreur.cause === undefined
  return {
    ...contexte,
    erreur: nom,
    ...(code ? { code } : {}),
    ...(maitrisee ? { message: erreur.statusMessage as string } : {}),
  }
}
