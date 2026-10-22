import type { H3Event } from 'h3'
import type { SecureSessionData, User } from '#auth-utils'
import { evaluerSession } from '../lib/session-guard'

export interface AuthContext {
  user: User
  secure: SecureSessionData
}

const SESSION_INVALIDE = 'Session invalide, veuillez vous reconnecter'

/**
 * Exige une session valide. `secure` est optionnel dans le typage nuxt-auth-utils
 * (`UserSessionRequired['secure']?: SecureSessionData`) — une session créée avant
 * l'introduction des données serveur-only n'en contiendrait pas. On le vérifie donc
 * explicitement plutôt que de le supposer présent, puis on valide le compte en base
 * (D8 : garde central `actif`/rôle/filiale/mot de passe de toutes les routes admin) —
 * une requête PK après le seul contrôle du cookie. Tout échec = 401 générique, le motif
 * reste dans la fonction pure (server/lib/session-guard.ts, testée en unit).
 */
export async function requireAuth(event: H3Event): Promise<AuthContext> {
  // `loggedInAt` est une claim racine de la session (posée par le login au même niveau que
  // `user`/`secure`), PAS un champ de `user` — la lire de `user` la rendrait toujours
  // undefined et déconnecterait toute session après un changement de mot de passe (D10).
  // nuxt-auth-utils lève un 401 sans statusMessage (« Unauthorized », sérialisé
  // « Server Error » en prod) quand il n'y a pas de session : on le remplace par le message
  // générique unique de toute la surface admin (spec lot 6 §2.2 / §10.3). Un échec inattendu
  // autre que 401 est conservé tel quel pour rester visible.
  const session = await requireUserSession(event).catch((erreur: unknown) => {
    const statusCode =
      typeof erreur === 'object' && erreur !== null && 'statusCode' in erreur
        ? (erreur as { statusCode?: unknown }).statusCode
        : undefined
    if (statusCode !== undefined && statusCode !== 401) throw erreur
    throw createError({ statusCode: 401, statusMessage: SESSION_INVALIDE })
  })
  const { user, secure, loggedInAt } = session
  if (!secure) {
    throw createError({ statusCode: 401, statusMessage: SESSION_INVALIDE })
  }
  const compte = await prisma.user.findUnique({
    where: { id: secure.userId },
    select: { actif: true, role: true, companyId: true, passwordChangedAt: true },
  })
  const resultat = evaluerSession(loggedInAt, { role: user.role, companyId: secure.companyId }, compte)
  if (!resultat.ok) {
    throw createError({ statusCode: 401, statusMessage: SESSION_INVALIDE })
  }
  return { user, secure }
}

/**
 * Exige une session ET un rôle autorisé. À appeler en premier dans toute route /api/admin/**.
 * 401 sans session (ou `secure` absent), 403 si rôle non autorisé.
 */
export async function requireRole(event: H3Event, allowed: readonly AppRole[]): Promise<AuthContext> {
  const context = await requireAuth(event)
  if (!allowed.includes(context.user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accès refusé' })
  }
  return context
}

/**
 * Filtre Prisma `where` de scoping par filiale.
 * SUPER_ADMIN : tout. Autres rôles : uniquement leur filiale — un compte sans filiale
 * rattachée est une anomalie de données, on refuse plutôt que de renvoyer une liste vide.
 * L'id numérique de filiale vient de `secure` (jamais exposé au client), jamais de `user`.
 */
export function companyScope(user: User, secure: SecureSessionData): { companyId?: number } {
  if (user.role === ROLES.SUPER_ADMIN) return {}
  if (secure.companyId === null) {
    throw createError({ statusCode: 403, statusMessage: 'Compte non rattaché à une filiale' })
  }
  return { companyId: secure.companyId }
}

/** Vérifie qu'une ressource appartient bien à la filiale de l'utilisateur (sauf SUPER_ADMIN). */
export function assertCompanyAccess(user: User, secure: SecureSessionData, resourceCompanyId: number | null): void {
  if (user.role === ROLES.SUPER_ADMIN) return
  if (secure.companyId === null || secure.companyId !== resourceCompanyId) {
    // 404 plutôt que 403 : ne pas révéler l'existence d'une ressource d'une autre filiale
    throw createError({ statusCode: 404, statusMessage: 'Introuvable' })
  }
}
