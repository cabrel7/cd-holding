// PATCH /api/admin/placement/candidats/[uuid] : modification d'un candidat du vivier.
import { z } from 'zod'
import { PLACEMENT_SLUG } from '#shared/config/candidature'
import { MODULES } from '#shared/config/modules'
import { candidatUpdateSchema } from '#shared/validation/placement'
import { updateCandidat } from '../../../../services/admin/placement'

const ROLES_PLACEMENT = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const
const paramsSchema = z.object({ uuid: z.string().uuid() })

export default defineEventHandler(async (event) => {
  const ctx = await requireModule(event, MODULES.PLACEMENT, { site: PLACEMENT_SLUG, roles: ROLES_PLACEMENT })
  const { uuid } = await getValidatedRouterParams(event, paramsSchema.parse)
  const data = await readValidatedBody(event, candidatUpdateSchema.parse)
  const candidat = await updateCandidat(ctx, uuid, data)
  setResponseHeader(event, 'cache-control', 'no-store')
  return candidat
})
