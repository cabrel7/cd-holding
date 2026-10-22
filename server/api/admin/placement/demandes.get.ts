// GET /api/admin/placement/demandes : demandes paginées (correspondants + affectations).
import { PLACEMENT_SLUG } from '#shared/config/candidature'
import { MODULES } from '#shared/config/modules'
import { demandesQuerySchema } from '#shared/validation/placement'
import { listDemandes } from '../../../services/admin/placement'

const ROLES_PLACEMENT = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const

export default defineEventHandler(async (event) => {
  const ctx = await requireModule(event, MODULES.PLACEMENT, { site: PLACEMENT_SLUG, roles: ROLES_PLACEMENT })
  const query = await getValidatedQuery(event, demandesQuerySchema.parse)
  setResponseHeader(event, 'cache-control', 'no-store')
  return listDemandes(ctx, query)
})
