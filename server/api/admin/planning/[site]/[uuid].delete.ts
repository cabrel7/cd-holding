// DELETE /api/admin/planning/[site]/[uuid] : suppression d'un quart (204, spec lot 5 §2).
import { z } from 'zod'
import { MODULES } from '#shared/config/modules'
import { planningSiteSchema } from '#shared/validation/planning'
import { deleteQuart } from '../../../../services/admin/planning'

const ROLES_PLANNING = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const
const paramsSchema = z.object({ site: planningSiteSchema, uuid: z.string().uuid() })

export default defineEventHandler(async (event) => {
  const { site, uuid } = await getValidatedRouterParams(event, paramsSchema.parse)
  const ctx = await requireModule(event, MODULES.PLANNING, { site, roles: ROLES_PLANNING })
  await deleteQuart(ctx, site, uuid)
  setResponseHeader(event, 'cache-control', 'no-store')
  setResponseStatus(event, 204)
  return null
})
