// PATCH /api/admin/utilisateurs/[uuid] : édition nom/rôle/filiale/actif (email immuable, D6).
// Orchestration (D7 du lot 5) : requireRole → rate-limit → params zod (uuid malformé = 400,
// jamais 500) → garde 4 Ko → zod → service → resetRateLimit.
import { z } from 'zod'
import { utilisateurUpdateSchema } from '#shared/validation/utilisateurs'
import { modifierCompte } from '../../../services/admin/utilisateurs'

const ROLES_COMPTES = [ROLES.SUPER_ADMIN] as const
const COMPTES_RATE_LIMIT = { scope: 'admin-comptes', max: 10, windowMs: 15 * 60 * 1000 } as const
const paramsSchema = z.object({ uuid: z.string().uuid() })
const MAX_BODY_BYTES = 4 * 1024

export default defineEventHandler(async (event) => {
  const { user, secure } = await requireRole(event, ROLES_COMPTES)
  const cle = String(secure.userId)
  assertRateLimit(event, { ...COMPTES_RATE_LIMIT, cle })

  const { uuid } = await getValidatedRouterParams(event, paramsSchema.parse)

  const contentLength = Number(getRequestHeader(event, 'content-length') ?? 0)
  if (contentLength > MAX_BODY_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Requête trop volumineuse' })
  }

  const body = await readValidatedBody(event, utilisateurUpdateSchema.parse)
  const compte = await modifierCompte(user.uuid, uuid, body)

  resetRateLimit(event, COMPTES_RATE_LIMIT.scope, cle)
  setResponseHeader(event, 'cache-control', 'no-store')
  return compte
})
