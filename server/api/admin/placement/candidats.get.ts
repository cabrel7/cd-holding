// GET /api/admin/placement/candidats : vivier paginé (filtré statut/origine/q).
import { PLACEMENT_SLUG } from '#shared/config/candidature'
import { MODULES } from '#shared/config/modules'
import { candidatsQuerySchema } from '#shared/validation/placement'
import { listCandidats } from '../../../services/admin/placement'

const ROLES_PLACEMENT = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const

export default defineEventHandler(async (event) => {
  const ctx = await requireModule(event, MODULES.PLACEMENT, { site: PLACEMENT_SLUG, roles: ROLES_PLACEMENT })
  const query = await getValidatedQuery(event, candidatsQuerySchema.parse)
  setResponseHeader(event, 'cache-control', 'no-store')
  return listCandidats(ctx, query)
})
