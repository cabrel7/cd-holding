// POST /api/admin/planning/[site] : création d'un quart (201, spec lot 5 §2).
import { z } from 'zod'
import { MODULES } from '#shared/config/modules'
import {
  planningSiteSchema,
  quartCreateSchema,
} from '#shared/validation/planning'
import { createQuart } from '../../../../services/admin/planning'

const ROLES_PLANNING = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const
const paramsSchema = z.object({ site: planningSiteSchema })

export default defineEventHandler(async (event) => {
  const { site } = await getValidatedRouterParams(event, paramsSchema.parse)
  const ctx = await requireModule(event, MODULES.PLANNING, { site, roles: ROLES_PLANNING })
  const data = await readValidatedBody(event, quartCreateSchema.parse)
  const quart = await createQuart(ctx, site, data)
  setResponseHeader(event, 'cache-control', 'no-store')
  setResponseStatus(event, 201)
  return quart
})
