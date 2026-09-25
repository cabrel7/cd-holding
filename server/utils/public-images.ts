// Vérification des images référencées par une écriture CMS (collections + sections, spec §4.2) :
// une clé de fichier doit pointer vers un `Fichier` existant, PUBLIC, de type MIME image, et
// appartenant à LA MÊME filiale que la ressource écrite. `collectImageKeys` est pure et parcourt
// les descripteurs de champs du catalogue de sections (server/services/cms/*.ts a son propre
// repérage, plus simple, pour les collections à champ image unique — imageKey/photoKey/logoKey).
import { PUBLIC_IMAGE_MIMES } from '#shared/config/upload'
import { sectionTypeDefinition, type CmsField, type SectionTypeKey } from '#shared/content/sections'

function collectFromFields(fields: readonly CmsField[], donnees: unknown): string[] {
  if (donnees === null || typeof donnees !== 'object') return []
  const obj = donnees as Record<string, unknown>
  const keys: string[] = []

  for (const field of fields) {
    const value = obj[field.key]
    if (value === null || value === undefined) continue

    if (field.type === 'image') {
      if (typeof value === 'string') keys.push(value)
      continue
    }

    // Le type 'liste' recouvre deux formes selon le catalogue : un tableau d'éléments
    // (galerie, chiffres) ou une paire d'objets nommés (duo : { a, b }) — on gère les deux.
    if (field.type === 'liste' && field.itemFields) {
      if (Array.isArray(value)) {
        for (const item of value) keys.push(...collectFromFields(field.itemFields, item))
      } else if (typeof value === 'object') {
        keys.push(...collectFromFields(field.itemFields, value))
      }
    }
  }

  return keys
}

/** Clés d'image référencées par les données d'une section, selon le type déclaré au catalogue. Pure. */
export function collectImageKeys(type: SectionTypeKey, donnees: unknown): string[] {
  return collectFromFields(sectionTypeDefinition(type).fields, donnees)
}

/**
 * Vérifie qu'un ensemble de clés d'image sont chacune : un Fichier existant, PUBLIC, de type MIME
 * image, appartenant à `companyId`. Lève 400 sur le premier écart, sans préciser lequel (existence,
 * visibilité, MIME ou filiale) — ne pas laisser sonder l'état de fichiers d'une autre filiale.
 */
export async function assertPublicImages(keys: readonly string[], companyId: number): Promise<void> {
  const uniqueKeys = [...new Set(keys)]
  if (uniqueKeys.length === 0) return

  const fichiers = await prisma.fichier.findMany({
    where: { key: { in: uniqueKeys } },
    select: { key: true, visibilite: true, mimeType: true, companyId: true },
  })
  const byKey = new Map(fichiers.map((fichier) => [fichier.key, fichier] as const))

  for (const key of uniqueKeys) {
    const fichier = byKey.get(key)
    const estValide =
      fichier !== undefined &&
      fichier.visibilite === 'PUBLIC' &&
      fichier.companyId === companyId &&
      (PUBLIC_IMAGE_MIMES as readonly string[]).includes(fichier.mimeType)
    if (!estValide) {
      throw createError({ statusCode: 400, statusMessage: 'Image invalide ou hors de votre filiale' })
    }
  }
}
