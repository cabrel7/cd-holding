// PATCH /api/admin/placement/demandes/[uuid] : modification, publication/dépublication d'offre.
import { z } from 'zod'
import { PLACEMENT_SLUG } from '#shared/config/candidature'
import { MODULES } from '#shared/config/modules'
import { demandeUpdateSchema } from '#shared/validation/placement'
import { updateDemande } from '../../../../services/admin/placement'

const ROLES_PLACEMENT = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const
const paramsSchema = z.object({ uuid: z.string().uuid() })

export default defineEventHandler(async (event) => {
  const ctx = await requireModule(event, MODULES.PLACEMENT, { site: PLACEMENT_SLUG, roles: ROLES_PLACEMENT })
  const { uuid } = await getValidatedRouterParams(event, paramsSchema.parse)
  const data = await readValidatedBody(event, demandeUpdateSchema.parse)
  const demande = await updateDemande(ctx, uuid, data)
  setResponseHeader(event, 'cache-control', 'no-store')
  return demande
})
