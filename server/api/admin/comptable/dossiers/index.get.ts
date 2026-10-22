// GET /api/admin/comptable/dossiers : liste paginée (filtre statut), tri échéance croissante.
import { COMPTABLE_SLUG } from '#shared/config/comptable'
import { MODULES } from '#shared/config/modules'
import { dossiersQuerySchema } from '#shared/validation/comptable'
import { listDossiers } from '../../../../services/admin/comptable'

const ROLES_COMPTABLE = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const

export default defineEventHandler(async (event) => {
  const ctx = await requireModule(event, MODULES.COMPTABLE, { site: COMPTABLE_SLUG, roles: ROLES_COMPTABLE })
  const query = await getValidatedQuery(event, dossiersQuerySchema.parse)
  setResponseHeader(event, 'cache-control', 'no-store')
  return listDossiers(ctx, query)
})
