// PATCH /api/admin/placement/candidatures/[uuid] : changement de statut (horloges Loi 25).
import { z } from 'zod'
import { PLACEMENT_SLUG } from '#shared/config/candidature'
import { MODULES } from '#shared/config/modules'
import { candidatureUpdateSchema } from '#shared/validation/placement'
import { updateCandidatureStatut } from '../../../../services/admin/placement'

const ROLES_PLACEMENT = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const
const paramsSchema = z.object({ uuid: z.string().uuid() })

export default defineEventHandler(async (event) => {
  const ctx = await requireModule(event, MODULES.PLACEMENT, { site: PLACEMENT_SLUG, roles: ROLES_PLACEMENT })
  const { uuid } = await getValidatedRouterParams(event, paramsSchema.parse)
  const { statut } = await readValidatedBody(event, candidatureUpdateSchema.parse)
  const candidature = await updateCandidatureStatut(ctx, uuid, statut)
  setResponseHeader(event, 'cache-control', 'no-store')
  return candidature
})
