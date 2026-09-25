import { z } from 'zod'
import { MULTIPART_OVERHEAD_BYTES } from '#shared/config/upload'

// Upload depuis le dashboard (images CMS, documents). Sert aussi de route de test du scaffold.
// L'upload public (candidatures Placement) aura sa propre route sous /api/public/**,
// avec visibilite PRIVE forcée et companyId résolu côté serveur depuis le slug.
const ALLOWED_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const
const FILE_FIELD = 'file'

const fieldsSchema = z.object({
  visibilite: z.enum(['PUBLIC', 'PRIVE']).default('PRIVE'),
  // Identifiant externe de filiale — uniquement pris en compte pour SUPER_ADMIN ;
  // ADMIN_FILIALE est toujours forcé sur sa propre filiale (secure.companyId).
  companyUuid: z.string().uuid().optional(),
})

export default defineEventHandler(async (event) => {
  const { user, secure } = await requireRole(event, ALLOWED_ROLES)

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

  let companyId: number | null
  if (user.role === ROLES.SUPER_ADMIN) {
    if (fields.companyUuid) {
      const company = await prisma.company.findUnique({
        where: { uuid: fields.companyUuid },
        select: { id: true },
      })
      if (!company) {
        throw createError({ statusCode: 404, statusMessage: 'Société inconnue' })
      }
      companyId = company.id
    } else {
      companyId = null
    }
  } else {
    if (secure.companyId === null) {
      throw createError({ statusCode: 403, statusMessage: 'Compte non rattaché à une filiale' })
    }
    companyId = secure.companyId
  }

  return saveUploadedFile(
    { data: file.data, filename: file.filename },
    { companyId, visibilite: fields.visibilite },
  )
})
