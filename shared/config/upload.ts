// Bornes d'upload partagées entre :
// - server/utils/storage.ts (limite applicative réelle, vérifiée après lecture du fichier)
// - server/api/admin/files/index.post.ts (garde-fou Content-Length avant lecture)
// - nuxt.config.ts (security.requestSizeLimiter de nuxt-security, middleware global qui
//   s'exécute AVANT le handler : doit autoriser au moins cette taille, sous peine de
//   rejeter en 413 des uploads pourtant valides).
// Un seul endroit à changer si la limite évolue.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 Mo
export const MULTIPART_OVERHEAD_BYTES = 64 * 1024

// Clé = UUID v4 + extension autorisée. Déplacé ici (depuis server/utils/storage.ts, qui le
// ré-exporte pour compatibilité) car partagé par la validation CMS (shared/validation/cms.ts,
// shared/content/sections/types.ts) et par le seed (T2) — tout le monde doit valider la même
// forme de clé, pas seulement le serveur d'upload.
export const STORAGE_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|png|jpg|webp)$/

// Types MIME acceptés pour une image affichée publiquement (CMS : logos, photos, héros...).
// Sous-ensemble des types acceptés à l'upload (server/lib/file-types.ts) : un PDF est un
// type d'upload valide (CV) mais n'est jamais une "image".
export const PUBLIC_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp'] as const
