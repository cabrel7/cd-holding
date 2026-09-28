import { consola } from 'consola'
import { formaterErreurPourLog } from '../lib/log-erreur'

/**
 * Hook d'erreur central Nitro : seul point qui logue les erreurs serveur.
 * - 5xx (anomalie serveur réelle) : loggé via consola.error, sans corps de requête, headers,
 *   cookies, query string ni `message`/`stack` d'une erreur non maîtrisée (une erreur Prisma y
 *   embarque des données personnelles) : voir server/lib/log-erreur.ts. Nom de classe + `code`
 *   + route seulement.
 * - 4xx (erreurs attendues : validation zod, 401/403/404/413/415/429...) : rien n'est loggé.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', async (error, { event }) => {
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500

    if (statusCode < 500) return

    // consola.error(obj) avec un objet unique portant `message` l'absorbe comme LogObject et
    // perd le reste du contexte : on passe donc un message texte en 1er argument et le contexte
    // en 2e (jamais de fusion avec 2 arguments).
    consola.error('Erreur serveur', formaterErreurPourLog(error, { statusCode, method: event?.method, path: event?.path }))
  })
})
