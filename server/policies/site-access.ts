// Politique d'accès aux ressources CMS scopées par filiale (spec phase 2 §4.2, "Côté serveur").
// Fonctions PURES : aucun accès à l'event H3 ni à Prisma ici, uniquement une décision à partir
// de données déjà résolues (rôle, filiale de session, filiale demandée). La résolution réelle
// (event, session, lookup Prisma du slug) vit dans server/utils/site-scope.ts, qui consomme
// ces fonctions et traduit leur résultat en erreurs HTTP.
//
// Import explicite (et non l'auto-import Nitro) : ce module est testé directement par
// tests/unit/site-access.test.ts, en dehors de tout contexte Nitro.
import { ROLES, type AppRole } from '#shared/utils/roles'

export type ReadScope = 'all' | 'company' | 'forbidden'
export type WriteScope = 'company' | 'forbidden' | 'missing'

export interface DecideScopeParams {
  readonly role: AppRole
  /** Filiale rattachée au compte (session.secure.companyId), null si aucune (ou SUPER_ADMIN). */
  readonly sessionCompanyId: number | null
  /** Filiale explicitement demandée par la requête (`?site=` ou `{site}` du body), null si absente. */
  readonly requestedCompanyId: number | null
}

/**
 * Portée de lecture (GET) d'une ressource CMS scopée par filiale.
 * - SUPER_ADMIN sans filiale demandée : 'all' (toutes les filiales, tri global côté service).
 * - SUPER_ADMIN avec une filiale demandée : 'company' (n'importe quelle filiale est autorisée).
 * - ADMIN_FILIALE : toujours 'company', forcé sur sa propre filiale — 'forbidden' si la filiale
 *   demandée diffère de la sienne, ou si le compte n'est rattaché à aucune filiale (anomalie).
 * - Tout autre rôle (EMPLOYE) : 'forbidden' — cette fonction ne fait que décider, le 403 réel
 *   est déjà couvert en amont par `requireRole`.
 */
export function decideReadScope({ role, sessionCompanyId, requestedCompanyId }: DecideScopeParams): ReadScope {
  if (role === ROLES.SUPER_ADMIN) {
    return requestedCompanyId === null ? 'all' : 'company'
  }
  if (role === ROLES.ADMIN_FILIALE) {
    if (sessionCompanyId === null) return 'forbidden'
    if (requestedCompanyId !== null && requestedCompanyId !== sessionCompanyId) return 'forbidden'
    return 'company'
  }
  return 'forbidden'
}

/**
 * Portée de `GET /api/admin/sites` (liste des sociétés elles-mêmes — pas une ressource avec FK
 * `companyId`, donc pas `decideReadScope` directement sur une requête paramétrée). Cette route
 * n'accepte aucun `?site=` : alias documenté de `decideReadScope` avec `requestedCompanyId: null`.
 * SUPER_ADMIN : 'all'. ADMIN_FILIALE rattaché : 'company' (sa propre société uniquement).
 * ADMIN_FILIALE non rattaché : 'forbidden' (anomalie de données, jamais une liste vide).
 */
export function decideSitesListScope(role: AppRole, sessionCompanyId: number | null): ReadScope {
  return decideReadScope({ role, sessionCompanyId, requestedCompanyId: null })
}

/**
 * Filiale cible d'une écriture (POST/PATCH/DELETE/réordonnancement) — toujours une seule filiale,
 * jamais une écriture "globale".
 * - SUPER_ADMIN : une filiale doit être explicitement désignée ('missing' sinon — aucune filiale
 *   par défaut à deviner côté serveur).
 * - ADMIN_FILIALE : toujours forcé sur sa propre filiale ; 'forbidden' si la filiale demandée
 *   diffère de la sienne, ou si le compte n'est rattaché à aucune filiale.
 * - Tout autre rôle : 'forbidden'.
 */
export function decideWriteCompany({ role, sessionCompanyId, requestedCompanyId }: DecideScopeParams): WriteScope {
  if (role === ROLES.SUPER_ADMIN) {
    return requestedCompanyId === null ? 'missing' : 'company'
  }
  if (role === ROLES.ADMIN_FILIALE) {
    if (sessionCompanyId === null) return 'forbidden'
    if (requestedCompanyId !== null && requestedCompanyId !== sessionCompanyId) return 'forbidden'
    return 'company'
  }
  return 'forbidden'
}
