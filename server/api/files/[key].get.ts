import { z } from 'zod'
import sharp from 'sharp'
import { LARGEURS_DERIVEES } from '#shared/utils/image-src'

// Lecture de fichier : aucun upload n'est servi statiquement.
// PUBLIC (images CMS des sites) : lisible sans session ; les images ont en plus des dérivés
// WebP responsives générés à la volée (largeurs de l'allowlist partagée `LARGEURS_DERIVEES`),
// mis en cache sur le stockage — la clé UUID est déjà versionnée → cache immutable long.
// PRIVE (CV, documents) : session + appartenance à la filiale (SUPER_ADMIN : tout), toujours
// l'original brut (attachment), jamais de dérivé.
const paramsSchema = z.object({
  key: z.string().refine(isValidStorageKey, 'Clé invalide'),
})

// Allowlist stricte : une largeur hors liste = 400, pour que les clés de cache dérivés
// restent finies (pas de cache poisoning par w=999999). Source unique : `LARGEURS_DERIVEES`
// (partagée avec le srcset front — un oubli côté serveur casserait les images servies).
const LARGEURS_ZOD = LARGEURS_DERIVEES.map((largeur) => String(largeur)) as [string, ...string[]]
const querySchema = z.object({
  w: z.enum(LARGEURS_ZOD).optional(),
  f: z.literal('webp').optional(),
})

const PUBLIC_CACHE = 'public, max-age=31536000, immutable'
const PRIVATE_CACHE = 'private, no-store'
// Fichier servi comme ressource inerte : aucun script/ressource chargé, iframe sandboxée.
const FILE_CSP = "default-src 'none'; sandbox"

/** Mimes réencadrables par sharp en dérivé (GIF/SVG/PDF laissés à l'original). */
const MIMES_DERIVABLES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
const QUALITE_WEBP = 80

// encodeURIComponent laisse passer ' ( ) * que RFC 5987 (attr-char) n'autorise pas.
const encoderRfc5987 = (valeur: string): string =>
  encodeURIComponent(valeur).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)

interface Derive {
  readonly data: Buffer
  readonly contentType: string
}

/**
 * Dérivé WebP (largeur bornée `withoutEnlargement`) : lecture du cache de stockage,
 * sinon génération sharp + écriture. `chemin` = `derived/<clé>-<largeur>.webp`.
 */
async function imageDerivee(key: string, source: Buffer, largeur: string | undefined, format: 'webp'): Promise<Derive> {
  const chemin = `derived/${key}-${largeur ?? 'orig'}.${format}`
  const cache = await uploadsStorage().getItemRaw<Buffer>(chemin)
  if (cache) return { data: cache, contentType: `image/${format}` }

  let pipeline = sharp(source, { failOn: 'none' })
  if (largeur) pipeline = pipeline.resize({ width: Number(largeur), withoutEnlargement: true })
  const genere = await pipeline.toFormat(format, { quality: QUALITE_WEBP }).toBuffer()
  // Meilleur effort : si l'écriture de cache échoue, le dérivé reste servi en mémoire.
  try {
    await uploadsStorage().setItemRaw(chemin, genere)
  } catch {
    // stockage indisponible → on sert quand même le dérivé généré
  }
  return { data: genere, contentType: `image/${format}` }
}

export default defineEventHandler(async (event) => {
  const { key } = await getValidatedRouterParams(event, paramsSchema.parse)
  const query = await getValidatedQuery(event, querySchema.parse)

  const fichier = await prisma.fichier.findUnique({ where: { key } })
  if (!fichier) {
    throw createError({ statusCode: 404, statusMessage: 'Introuvable' })
  }

  const prive = fichier.visibilite === 'PRIVE'
  if (prive) {
    const { user, secure } = await requireAuth(event)
    assertCompanyAccess(user, secure, fichier.companyId)
  }

  const original = await uploadsStorage().getItemRaw<Buffer>(key)
  if (!original) {
    throw createError({ statusCode: 404, statusMessage: 'Introuvable' })
  }

  // Dérivés uniquement pour PUBLIC + image réencadrable + demande explicite (w/f).
  // Repli strict sur l'original si sharp échoue (corrupt, animé...) : jamais d'erreur 500
  // là où l'original s'affichait déjà.
  let corps: Buffer = original
  let contentType = fichier.mimeType
  if (!prive && (query.w || query.f) && MIMES_DERIVABLES.has(fichier.mimeType)) {
    try {
      const d = await imageDerivee(key, original, query.w, query.f ?? 'webp')
      corps = d.data
      contentType = d.contentType
    } catch {
      // repli sur l'original (contentType/mime d'origine déjà en place)
    }
  }

  // PRIVE en attachment (jamais inline) : un PDF/JPEG piégé (candidature, document comptable)
  // ne doit jamais pouvoir s'exécuter/s'afficher dans notre origine — spec lot 3 §0/§6 critère 6.
  const disposition = prive ? 'attachment' : 'inline'

  setResponseHeaders(event, {
    'Content-Type': contentType,
    'Content-Length': String(corps.byteLength),
    'Cache-Control': prive ? PRIVATE_CACHE : PUBLIC_CACHE,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': FILE_CSP,
    'Content-Disposition': `${disposition}; filename*=UTF-8''${encoderRfc5987(fichier.nomOriginal)}`,
  })

  return corps
})
