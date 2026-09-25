import type { H3Event } from 'h3'
import type { User } from '#auth-utils'

/**
 * Exige une session ET un rôle autorisé. À appeler en premier dans toute route /api/admin/**.
 * 401 sans session (via requireUserSession), 403 si rôle non autorisé.
 */
export async function requireRole(event: H3Event, allowed: readonly AppRole[]): Promise<User> {
  const { user } = await requireUserSession(event)
  if (!allowed.includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accès refusé' })
  }
  return user
}

/**
 * Filtre Prisma `where` de scoping par filiale.
 * SUPER_ADMIN : tout. Autres rôles : uniquement leur filiale — un compte sans filiale
 * rattachée est une anomalie de données, on refuse plutôt que de renvoyer une liste vide.
 */
export function companyScope(user: User): { companyId?: string } {
  if (user.role === ROLES.SUPER_ADMIN) return {}
  if (!user.companyId) {
    throw createError({ statusCode: 403, statusMessage: 'Compte non rattaché à une filiale' })
  }
  return { companyId: user.companyId }
}

/** Vérifie qu'une ressource appartient bien à la filiale de l'utilisateur (sauf SUPER_ADMIN). */
export function assertCompanyAccess(user: User, resourceCompanyId: string | null): void {
  if (user.role === ROLES.SUPER_ADMIN) return
  if (!user.companyId || user.companyId !== resourceCompanyId) {
    // 404 plutôt que 403 : ne pas révéler l'existence d'une ressource d'une autre filiale
    throw createError({ statusCode: 404, statusMessage: 'Introuvable' })
  }
}
