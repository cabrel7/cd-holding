// POST /api/admin/placement/candidats : création manuelle d'un candidat (201, sans CV).
import { PLACEMENT_SLUG } from '#shared/config/candidature'
import { MODULES } from '#shared/config/modules'
import { candidatCreateSchema } from '#shared/validation/placement'
import { createCandidat } from '../../../services/admin/placement'

const ROLES_PLACEMENT = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const

export default defineEventHandler(async (event) => {
  const ctx = await requireModule(event, MODULES.PLACEMENT, { site: PLACEMENT_SLUG, roles: ROLES_PLACEMENT })
  const data = await readValidatedBody(event, candidatCreateSchema.parse)
  const candidat = await createCandidat(ctx, data)
  setResponseHeader(event, 'cache-control', 'no-store')
  setResponseStatus(event, 201)
  return candidat
})
