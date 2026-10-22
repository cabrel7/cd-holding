// GET /api/admin/planning/[site] : grille semaine (employés + quarts, spec lot 5 §2).
import { z } from 'zod'
import { MODULES } from '#shared/config/modules'
import { planningSemaineQuerySchema, planningSiteSchema } from '#shared/validation/planning'
import { listSemaine } from '../../../../services/admin/planning'

const ROLES_PLANNING = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const
const paramsSchema = z.object({ site: planningSiteSchema })

export default defineEventHandler(async (event) => {
  // `site` validé AVANT requireModule : slug inconnu → 400, jamais 500.
  const { site } = await getValidatedRouterParams(event, paramsSchema.parse)
  const ctx = await requireModule(event, MODULES.PLANNING, { site, roles: ROLES_PLANNING })
  const query = await getValidatedQuery(event, planningSemaineQuerySchema.parse)
  setResponseHeader(event, 'cache-control', 'no-store')
  return listSemaine(ctx, site, query)
})
