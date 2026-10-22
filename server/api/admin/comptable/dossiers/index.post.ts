// POST /api/admin/comptable/dossiers : création (201) — crée Client + DossierComptable en transaction.
import { COMPTABLE_SLUG } from '#shared/config/comptable'
import { MODULES } from '#shared/config/modules'
import { dossierCreateSchema } from '#shared/validation/comptable'
import { createDossier } from '../../../../services/admin/comptable'

const ROLES_COMPTABLE = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const

export default defineEventHandler(async (event) => {
  const ctx = await requireModule(event, MODULES.COMPTABLE, { site: COMPTABLE_SLUG, roles: ROLES_COMPTABLE })
  const data = await readValidatedBody(event, dossierCreateSchema.parse)
  const dossier = await createDossier(ctx, data)
  setResponseHeader(event, 'cache-control', 'no-store')
  setResponseStatus(event, 201)
  return dossier
})
