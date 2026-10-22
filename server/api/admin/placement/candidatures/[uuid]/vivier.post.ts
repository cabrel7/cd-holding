// POST /api/admin/placement/candidatures/[uuid]/vivier : ajoute au vivier + copie le CV (201).
import { z } from 'zod'
import { PLACEMENT_SLUG } from '#shared/config/candidature'
import { MODULES } from '#shared/config/modules'
import { ajouterAuVivier } from '../../../../../services/admin/placement'

const ROLES_PLACEMENT = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const
const paramsSchema = z.object({ uuid: z.string().uuid() })

export default defineEventHandler(async (event) => {
  const ctx = await requireModule(event, MODULES.PLACEMENT, { site: PLACEMENT_SLUG, roles: ROLES_PLACEMENT })
  const { uuid } = await getValidatedRouterParams(event, paramsSchema.parse)
  const candidat = await ajouterAuVivier(ctx, uuid)
  setResponseHeader(event, 'cache-control', 'no-store')
  setResponseStatus(event, 201)
  return candidat
})
