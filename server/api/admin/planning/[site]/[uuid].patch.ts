// PATCH /api/admin/planning/[site]/[uuid] : modification partielle d'un quart (spec lot 5 §2).
import { z } from 'zod'
import { MODULES } from '#shared/config/modules'
import {
  planningSiteSchema,
  quartUpdateSchema,
} from '#shared/validation/planning'
import { updateQuart } from '../../../../services/admin/planning'

const ROLES_PLANNING = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const
const paramsSchema = z.object({ site: planningSiteSchema, uuid: z.string().uuid() })

export default defineEventHandler(async (event) => {
  const { site, uuid } = await getValidatedRouterParams(event, paramsSchema.parse)
  const ctx = await requireModule(event, MODULES.PLANNING, { site, roles: ROLES_PLANNING })
  const data = await readValidatedBody(event, quartUpdateSchema.parse)
  const quart = await updateQuart(ctx, site, uuid, data)
  setResponseHeader(event, 'cache-control', 'no-store')
  return quart
})
