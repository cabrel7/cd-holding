// POST /api/admin/placement/demandes/[uuid]/affectations : affecte un candidat (201, → PLACE).
import { z } from 'zod'
import { PLACEMENT_SLUG } from '#shared/config/candidature'
import { MODULES } from '#shared/config/modules'
import { affectationCreateSchema } from '#shared/validation/placement'
import { affecter } from '../../../../../services/admin/placement'

const ROLES_PLACEMENT = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const
const paramsSchema = z.object({ uuid: z.string().uuid() })

export default defineEventHandler(async (event) => {
  const ctx = await requireModule(event, MODULES.PLACEMENT, { site: PLACEMENT_SLUG, roles: ROLES_PLACEMENT })
  const { uuid } = await getValidatedRouterParams(event, paramsSchema.parse)
  const data = await readValidatedBody(event, affectationCreateSchema.parse)
  const demande = await affecter(ctx, uuid, data)
  setResponseHeader(event, 'cache-control', 'no-store')
  setResponseStatus(event, 201)
  return demande
})
