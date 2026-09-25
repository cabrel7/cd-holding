import { randomUUID } from 'node:crypto'
import type { VisibiliteFichier } from '../generated/prisma/client'
// Source unique de la borne de taille (voir shared/config/upload.ts) — aussi utilisée par
// nuxt.config.ts (requestSizeLimiter de nuxt-security). La forme de clé (STORAGE_KEY_PATTERN)
// vit dans shared/utils/files.ts (`isValidStorageKey`, auto-importé, utilisé par
// server/api/files/[key].get.ts) — pas redéfinie ici pour éviter un doublon d'auto-import.
import { MAX_UPLOAD_BYTES } from '#shared/config/upload'
// server/lib/ n'est PAS auto-importé par Nitro (contrairement à server/utils/) : import
// explicite, nécessaire aussi pour rester réutilisable tel quel par le seed (T2, import relatif).
import { extensionForMime, mimeFromExtension, sniffMime, type AllowedUploadMime } from '../lib/file-types'

export const UPLOADS_MOUNT = 'uploads'
export { MAX_UPLOAD_BYTES }

type AllowedMime = AllowedUploadMime

export function mimeFromKey(key: string): AllowedMime | undefined {
  const ext = key.split('.').pop()
  return ext ? mimeFromExtension(ext) : undefined
}

export function uploadsStorage() {
  return useStorage(UPLOADS_MOUNT)
}

export interface UploadInput {
  data: Buffer
  filename?: string
}

export interface SaveOptions {
  companyId: number | null
  visibilite: VisibiliteFichier
}

/**
 * Enregistre un fichier uploadé et le référence dans la table Fichier.
 * Retourne la clé de stockage (UUID). Le nom original n'est conservé qu'en métadonnée d'affichage.
 */
export async function saveUploadedFile(file: UploadInput, options: SaveOptions) {
  if (file.data.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Fichier vide' })
  }
  if (file.data.length > MAX_UPLOAD_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Fichier trop volumineux (max 10 Mo)' })
  }

  const mimeType = sniffMime(file.data)
  if (!mimeType) {
    throw createError({ statusCode: 415, statusMessage: 'Type de fichier non autorisé (PDF, PNG, JPEG, WebP)' })
  }

  const key = `${randomUUID()}.${extensionForMime(mimeType)}`
  const nomOriginal = (file.filename ?? 'fichier').slice(0, 255)

  await uploadsStorage().setItemRaw(key, file.data)
  try {
    await prisma.fichier.create({
      data: {
        key,
        nomOriginal,
        mimeType,
        taille: file.data.length,
        visibilite: options.visibilite,
        companyId: options.companyId,
      },
    })
  } catch (error) {
    // Pas de fichier orphelin sur disque si l'écriture en base échoue
    await uploadsStorage().removeItem(key)
    throw error
  }

  return { key, nomOriginal, mimeType }
}
