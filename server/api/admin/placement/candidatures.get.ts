// GET /api/admin/placement/candidatures : candidatures paginées (documents joints).
import { PLACEMENT_SLUG } from '#shared/config/candidature'
import { MODULES } from '#shared/config/modules'
import { candidaturesQuerySchema } from '#shared/validation/placement'
import { listCandidatures } from '../../../services/admin/placement'

const ROLES_PLACEMENT = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const

export default defineEventHandler(async (event) => {
  const ctx = await requireModule(event, MODULES.PLACEMENT, { site: PLACEMENT_SLUG, roles: ROLES_PLACEMENT })
  const query = await getValidatedQuery(event, candidaturesQuerySchema.parse)
  setResponseHeader(event, 'cache-control', 'no-store')
  return listCandidatures(ctx, query)
})
