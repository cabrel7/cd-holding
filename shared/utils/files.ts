// Helpers purs autour des clés de stockage — utilisables côté client (affichage) ET serveur.
// La détection du type réel d'un fichier (magic bytes) reste côté serveur uniquement
// (server/lib/file-types.ts) : un client ne doit jamais être source de vérité sur un MIME.
import { PUBLIC_IMAGE_MIMES, STORAGE_KEY_PATTERN } from '../config/upload'

export function isValidStorageKey(key: string): boolean {
  return STORAGE_KEY_PATTERN.test(key)
}

/** Construit l'URL de lecture d'un fichier (toujours via la route API, jamais statique). */
export function fileUrl(key: string): string {
  return `/api/files/${encodeURIComponent(key)}`
}

export function extensionFromKey(key: string): string | undefined {
  return key.split('.').pop()
}

export function isPublicImageMime(mime: string): mime is (typeof PUBLIC_IMAGE_MIMES)[number] {
  return (PUBLIC_IMAGE_MIMES as readonly string[]).includes(mime)
}
