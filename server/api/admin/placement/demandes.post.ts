// POST /api/admin/placement/demandes : création (201, jamais publiée à la création).
import { PLACEMENT_SLUG } from '#shared/config/candidature'
import { MODULES } from '#shared/config/modules'
import { demandeCreateSchema } from '#shared/validation/placement'
import { createDemande } from '../../../services/admin/placement'

const ROLES_PLACEMENT = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const

export default defineEventHandler(async (event) => {
  const ctx = await requireModule(event, MODULES.PLACEMENT, { site: PLACEMENT_SLUG, roles: ROLES_PLACEMENT })
  const data = await readValidatedBody(event, demandeCreateSchema.parse)
  const demande = await createDemande(ctx, data)
  setResponseHeader(event, 'cache-control', 'no-store')
  setResponseStatus(event, 201)
  return demande
})
