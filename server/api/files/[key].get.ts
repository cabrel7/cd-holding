import { z } from 'zod'

// Lecture de fichier : aucun upload n'est servi statiquement.
// PUBLIC (images CMS des sites) : lisible sans session.
// PRIVE (CV, documents) : session + appartenance à la filiale (SUPER_ADMIN : tout).
const paramsSchema = z.object({
  key: z.string().refine(isValidStorageKey, 'Clé invalide'),
})

const PUBLIC_CACHE = 'public, max-age=86400, immutable'
const PRIVATE_CACHE = 'private, no-store'

export default defineEventHandler(async (event) => {
  const { key } = await getValidatedRouterParams(event, paramsSchema.parse)

  const fichier = await prisma.fichier.findUnique({ where: { key } })
  if (!fichier) {
    throw createError({ statusCode: 404, statusMessage: 'Introuvable' })
  }

  if (fichier.visibilite === 'PRIVE') {
    const { user } = await requireUserSession(event)
    assertCompanyAccess(user, fichier.companyId)
  }

  const data = await uploadsStorage().getItemRaw<Buffer>(key)
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Introuvable' })
  }

  setResponseHeaders(event, {
    'Content-Type': fichier.mimeType,
    'Content-Length': String(fichier.taille),
    'Cache-Control': fichier.visibilite === 'PUBLIC' ? PUBLIC_CACHE : PRIVATE_CACHE,
    'X-Content-Type-Options': 'nosniff',
    // Nom original encodé RFC 5987 — jamais interprété comme chemin
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(fichier.nomOriginal)}`,
  })

  return data
})
