// Sème les images du générateur (prisma/seed-assets/images/) dans le storage `uploads`
// (unstorage, driver fs — même driver que server/plugins/storage.ts) et la table `Fichier`
// (spec §2, module "outil"). Import relatif de server/lib/file-types.ts (T0), qui n'est PAS
// auto-importé par Nitro et reste utilisable tel quel hors contexte Nitro (tsx).
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fsDriver from 'unstorage/drivers/fs'
import { createStorage } from 'unstorage'
import { sniffMime, extensionForMime } from '../../server/lib/file-types'
import { VisibiliteFichier, type PrismaClient } from '../../server/generated/prisma/client'
import { GENERATED } from '../seed-data/prototype.generated'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const IMAGES_DIR = path.join(__dirname, '../seed-assets/images')

function requireEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback
}

// Même variable que server/plugins/storage.ts (NUXT_UPLOADS_DIR → runtimeConfig.uploadsDir),
// lue directement ici : ce script tourne hors contexte Nitro, `useRuntimeConfig()` n'existe pas.
const uploadsStorage = createStorage({
  driver: fsDriver({ base: requireEnv('NUXT_UPLOADS_DIR', './storage/uploads') }),
})

/** Marqueur de traçabilité seed dans `nomOriginal` (métadonnée d'affichage) — sert à l'amorçage :
 * ne recrée jamais un Fichier + blob déjà semés pour la même filiale et la même photo source. */
function seedMarker(photoId: string): string {
  return `seed:${photoId}.jpg`
}

const imageById = new Map(GENERATED.images.map((img) => [img.id, img] as const))

/**
 * Sème (si absent) l'image `photoId` comme Fichier PUBLIC de la filiale `companyId`, et retourne
 * sa clé de stockage. Idempotent : relancer le seed ne recrée ni le fichier sur disque, ni la
 * ligne `Fichier` (recherche par le marqueur posé dans `nomOriginal`, scopé à la filiale).
 */
export async function seedImage(prisma: PrismaClient, companyId: number, photoId: string): Promise<string> {
  const marker = seedMarker(photoId)
  const existing = await prisma.fichier.findFirst({ where: { companyId, nomOriginal: marker }, select: { key: true } })
  if (existing) return existing.key

  const source = imageById.get(photoId)
  if (!source) {
    throw new Error(`Image "${photoId}" absente de prototype.generated.ts — relancer le générateur ?`)
  }

  const bytes = await readFile(path.join(IMAGES_DIR, source.file))
  const mimeType = sniffMime(bytes)
  if (!mimeType) {
    throw new Error(`Octets magiques invalides pour ${source.file} — image corrompue ou tronquée`)
  }

  const key = `${randomUUID()}.${extensionForMime(mimeType)}`
  await uploadsStorage.setItemRaw(key, bytes)
  await prisma.fichier.create({
    data: {
      key,
      nomOriginal: marker,
      mimeType,
      taille: bytes.length,
      visibilite: VisibiliteFichier.PUBLIC,
      companyId,
    },
  })
  return key
}

const FAKE_CV_BYTES = Buffer.from(
  '%PDF-1.4\n% CV de démonstration généré par le seed — aucune donnée réelle.\n1 0 obj<< /Type /Catalog >>endobj\ntrailer<< /Root 1 0 R >>\n%%EOF\n',
  'latin1',
)

/**
 * Crée un PDF minimal factice comme Fichier PRIVE de `companyId` (spec §3.4, candidatures de
 * démo) — pas de données personnelles réelles. Toujours un nouveau Fichier (une candidature de
 * démo = un faux CV distinct) ; c'est l'appelant (demo.ts) qui garde l'idempotence en ne
 * recréant pas la `Candidature` elle-même au reseed.
 */
export async function seedFakeCv(prisma: PrismaClient, companyId: number, nomAffiche: string): Promise<string> {
  const key = `${randomUUID()}.pdf`
  await uploadsStorage.setItemRaw(key, FAKE_CV_BYTES)
  await prisma.fichier.create({
    data: {
      key,
      nomOriginal: nomAffiche.slice(0, 255),
      mimeType: 'application/pdf',
      taille: FAKE_CV_BYTES.length,
      visibilite: VisibiliteFichier.PRIVE,
      companyId,
    },
  })
  return key
}
