import { z } from 'zod'

// Upload depuis le dashboard (images CMS, documents). Sert aussi de route de test du scaffold.
// L'upload public (candidatures Placement) aura sa propre route sous /api/public/**,
// avec visibilite PRIVE forcée et companyId résolu côté serveur depuis le slug.
const ALLOWED_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const
const FILE_FIELD = 'file'
const MULTIPART_OVERHEAD_BYTES = 64 * 1024

const fieldsSchema = z.object({
  visibilite: z.enum(['PUBLIC', 'PRIVE']).default('PRIVE'),
  // Uniquement pris en compte pour SUPER_ADMIN ; ADMIN_FILIALE est forcé sur sa filiale.
  companyId: z.string().cuid().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ALLOWED_ROLES)

  // Rejet avant lecture : readMultipartFormData charge tout le corps en mémoire
  const contentLength = Number(getRequestHeader(event, 'content-length') ?? 0)
  if (!contentLength || contentLength > MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Requête trop volumineuse' })
  }

  const parts = await readMultipartFormData(event)
  if (!parts) {
    throw createError({ statusCode: 400, statusMessage: 'Formulaire multipart attendu' })
  }

  const textFields = Object.fromEntries(
    parts.filter((p) => !p.filename && p.name).map((p) => [p.name, p.data.toString('utf8')]),
  )
  const fields = fieldsSchema.parse(textFields)

  const file = parts.find((p) => p.name === FILE_FIELD && p.filename)
  if (!file) {
    throw createError({ statusCode: 400, statusMessage: `Champ "${FILE_FIELD}" manquant` })
  }

  const companyId = user.role === ROLES.SUPER_ADMIN ? (fields.companyId ?? null) : user.companyId
  if (user.role !== ROLES.SUPER_ADMIN && !companyId) {
    throw createError({ statusCode: 403, statusMessage: 'Compte non rattaché à une filiale' })
  }

  return saveUploadedFile(
    { data: file.data, filename: file.filename },
    { companyId, visibilite: fields.visibilite },
  )
})
