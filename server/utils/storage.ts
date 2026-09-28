import { consola } from 'consola'
import { randomUUID } from 'node:crypto'
import { basename } from 'node:path'
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

export interface SavedFile {
  readonly key: string
  readonly nomOriginal: string
  readonly mimeType: AllowedMime
}

// Caractères de contrôle (un NUL ferait une 500 Postgres), sauf aucun n'est légitime dans un nom
// de fichier affiché. Même famille que shared/validation/contact.ts (CONTROLE_PATTERN), redéfinie
// ici pour rester locale à ce fichier (pas d'import shared → server dans ce sens).
// eslint-disable-next-line no-control-regex
const CONTROLE_PATTERN = /[\u0000-\u001F\u007F]/g
// Caractères de format Unicode (catégorie Cf : bidi U+202A–U+202E / U+2066–U+2069, zéro-largeur
// U+200B–U+200F, BOM U+FEFF…) : un `cv\u202Efdp.exe` s'afficherait « cvexe.pdf » (usurpation d'extension).
const FORMAT_PATTERN = /\p{Cf}/gu

/**
 * Nettoie le nom de fichier original avant de le conserver en métadonnée d'affichage (spec lot 3
 * §3) : nom de base seulement (un chemin, ex. `../../etc/passwd` ou `C:\x\y.pdf`, est réduit à son
 * dernier segment — jamais interprété comme chemin de stockage, `key` UUID reste le seul
 * identifiant physique), caractères de contrôle et de format (bidi, zéro-largeur) retirés, forme Unicode NFC, 255 caractères max.
 */
export function nettoyerNomFichier(filename: string | undefined): string {
  const segment = basename((filename ?? '').replace(/\\/g, '/'))
  const nettoye = segment.replace(CONTROLE_PATTERN, '').replace(FORMAT_PATTERN, '').normalize('NFC').trim()
  return (nettoye || 'fichier').slice(0, 255)
}

/**
 * Enregistre un fichier uploadé et le référence dans la table Fichier.
 * Retourne la clé de stockage (UUID). Le nom original n'est conservé qu'en métadonnée d'affichage.
 */
export async function saveUploadedFile(file: UploadInput, options: SaveOptions): Promise<SavedFile> {
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
  const nomOriginal = nettoyerNomFichier(file.filename)

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

/**
 * Enregistre plusieurs fichiers comme un seul lot applicatif (spec lot 3 §3, étape 9 — CV +
 * documents d'une candidature) : si l'un des fichiers échoue (stockage ou Prisma), les fichiers
 * déjà enregistrés du même lot sont nettoyés avant de relancer l'erreur — jamais de fichier
 * orphelin, même sur un échec partiel.
 */
export async function saveUploadedFiles(files: readonly UploadInput[], options: SaveOptions): Promise<SavedFile[]> {
  const saved: SavedFile[] = []
  try {
    for (const file of files) {
      saved.push(await saveUploadedFile(file, options))
    }
    return saved
  } catch (error) {
    await supprimerFichiers(saved.map((f) => f.key))
    throw error
  }
}

/**
 * Supprime un lot de fichiers (objet stocké + ligne Fichier) — retour arrière après un échec
 * Prisma en aval de l'upload (ex. `Candidature.create`), ou nettoyage de données de test. N'échoue
 * jamais bruyamment (le retour arrière ne doit pas masquer l'erreur d'origine) mais un
 * nettoyage partiel est journalisé, avec la seule clé UUID (aucune PII).
 */
export async function supprimerFichiers(keys: readonly string[]): Promise<void> {
  await Promise.all(
    keys.map(async (key) => {
      const avertir = (): void => consola.warn('[storage] nettoyage partiel', { key })
      await uploadsStorage()
        .removeItem(key)
        .catch(avertir)
      await prisma.fichier.deleteMany({ where: { key } }).catch(avertir)
    }),
  )
}
