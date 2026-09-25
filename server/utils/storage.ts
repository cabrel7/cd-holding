import { randomUUID } from 'node:crypto'
import type { VisibiliteFichier } from '../generated/prisma/client'

export const UPLOADS_MOUNT = 'uploads'
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 Mo

// Type MIME autorisé -> extension de stockage. L'extension vient du type DÉTECTÉ,
// jamais du nom de fichier fourni par l'utilisateur.
const ALLOWED_TYPES = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
} as const

type AllowedMime = keyof typeof ALLOWED_TYPES

// Clé = UUID v4 + extension autorisée. Tout le reste est rejeté avant d'atteindre le storage
// (empêche traversée de chemin / séparateurs unstorage `:` dans le paramètre de route).
const STORAGE_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|png|jpg|webp)$/

export function isValidStorageKey(key: string): boolean {
  return STORAGE_KEY_PATTERN.test(key)
}

export function mimeFromKey(key: string): AllowedMime | undefined {
  const ext = key.split('.').pop()
  return (Object.keys(ALLOWED_TYPES) as AllowedMime[]).find((mime) => ALLOWED_TYPES[mime] === ext)
}

/** Détecte le type réel via les magic bytes — le Content-Type déclaré par le client n'est pas fiable. */
function sniffMime(data: Buffer): AllowedMime | undefined {
  if (data.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf'
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg'
  if (data.subarray(0, 4).toString('latin1') === 'RIFF' && data.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp'
  return undefined
}

export function uploadsStorage() {
  return useStorage(UPLOADS_MOUNT)
}

export interface UploadInput {
  data: Buffer
  filename?: string
}

export interface SaveOptions {
  companyId: string | null
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

  const key = `${randomUUID()}.${ALLOWED_TYPES[mimeType]}`
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
