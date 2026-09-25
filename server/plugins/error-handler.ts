import { consola } from 'consola'

/**
 * Retire la query string d'un chemin avant de le logger : elle peut contenir des données
 * sensibles (token, email...) passées par erreur en paramètre d'URL.
 */
function pathWithoutQuery(path: string | undefined): string | undefined {
  if (!path) return path
  const queryIndex = path.indexOf('?')
  return queryIndex === -1 ? path : path.slice(0, queryIndex)
}

/**
 * Hook d'erreur central Nitro : seul point qui logue les erreurs serveur.
 * - 5xx (anomalie serveur réelle) : loggé via consola.error, sans jamais inclure le corps
 *   de la requête, les headers/cookies, ni une donnée personnelle (email, mot de passe...).
 *   La stack n'est incluse qu'en dehors de la production.
 * - 4xx (erreurs attendues : validation zod, 401/403/404/413/415/429...) : ce sont des
 *   réponses normales du contrôle d'accès/de la validation, pas des anomalies à investiguer
 *   — rien n'est loggé.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', async (error, { event }) => {
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500

    if (statusCode < 500) return

    // IMPORTANT : consola.error(obj) traite un objet unique ayant une clé `message` (et sans
    // clé `stack` truthy) comme son propre LogObject interne (voir node_modules/consola
    // dist/core.mjs `isLogObj`/`_logFn`) — il n'affiche alors QUE `message`, en silence sur le
    // reste (statusCode/method/path perdus). C'est le bug observé en prod (stack undefined ==
    // pas de clé `stack` truthy == objet absorbé comme LogObject). On passe donc un message
    // texte en 1er argument (jamais absorbé) et l'objet de contexte en 2e argument : avec 2
    // arguments, consola ne fait plus jamais cette fusion (`args.length === 1` uniquement) et
    // formatte le tout via util.formatWithOptions, qui affiche bien toutes les clés.
    const context: Record<string, unknown> = {
      statusCode,
      method: event?.method,
      path: pathWithoutQuery(event?.path),
      message: error.message,
    }

    // La stack n'est jamais mise dans `context` : un objet portant une clé `stack` en string
    // déclenche un autre traitement spécial de consola (formatage "erreur", qui ignore les
    // autres clés de l'objet). En dehors de la prod, on la loggue comme argument séparé.
    if (process.env.NODE_ENV !== 'production' && error.stack) {
      consola.error('Erreur serveur', context, error.stack)
    } else {
      consola.error('Erreur serveur', context)
    }
  })
})
