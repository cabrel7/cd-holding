import type { H3Event } from 'h3'
import type { SecureSessionData, User } from '#auth-utils'

export interface AuthContext {
  user: User
  secure: SecureSessionData
}

/**
 * Exige une session valide. `secure` est optionnel dans le typage nuxt-auth-utils
 * (`UserSessionRequired['secure']?: SecureSessionData`) — une session créée avant
 * l'introduction des données serveur-only n'en contiendrait pas. On le vérifie donc
 * explicitement plutôt que de le supposer présent, et on renvoie 401 si absent
 * (l'utilisateur doit se reconnecter pour obtenir une session à jour).
 */
export async function requireAuth(event: H3Event): Promise<AuthContext> {
  const { user, secure } = await requireUserSession(event)
  if (!secure) {
    throw createError({ statusCode: 401, statusMessage: 'Session invalide, veuillez vous reconnecter' })
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
