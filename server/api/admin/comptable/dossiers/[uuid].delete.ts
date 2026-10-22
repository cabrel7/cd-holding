// DELETE /api/admin/comptable/dossiers/[uuid] : suppression (204) — le Client CRM survit.
import { z } from 'zod'
import { COMPTABLE_SLUG } from '#shared/config/comptable'
import { MODULES } from '#shared/config/modules'
import { deleteDossier } from '../../../../services/admin/comptable'

const ROLES_COMPTABLE = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const
const paramsSchema = z.object({ uuid: z.string().uuid() })

export default defineEventHandler(async (event) => {
  const ctx = await requireModule(event, MODULES.COMPTABLE, { site: COMPTABLE_SLUG, roles: ROLES_COMPTABLE })
  const { uuid } = await getValidatedRouterParams(event, paramsSchema.parse)
  await deleteDossier(ctx, uuid)
  setResponseHeader(event, 'cache-control', 'no-store')
  setResponseStatus(event, 204)
  return null
})
