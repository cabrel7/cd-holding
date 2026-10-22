// PATCH /api/admin/comptable/dossiers/[uuid] : modification (dossier + champs Client liés).
import { z } from 'zod'
import { COMPTABLE_SLUG } from '#shared/config/comptable'
import { MODULES } from '#shared/config/modules'
import { dossierUpdateSchema } from '#shared/validation/comptable'
import { updateDossier } from '../../../../services/admin/comptable'

const ROLES_COMPTABLE = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const
const paramsSchema = z.object({ uuid: z.string().uuid() })

export default defineEventHandler(async (event) => {
  const ctx = await requireModule(event, MODULES.COMPTABLE, { site: COMPTABLE_SLUG, roles: ROLES_COMPTABLE })
  const { uuid } = await getValidatedRouterParams(event, paramsSchema.parse)
  const data = await readValidatedBody(event, dossierUpdateSchema.parse)
  const dossier = await updateDossier(ctx, uuid, data)
  setResponseHeader(event, 'cache-control', 'no-store')
  return dossier
})
