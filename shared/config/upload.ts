// Bornes d'upload partagées entre :
// - server/utils/storage.ts (limite applicative réelle, vérifiée après lecture du fichier)
// - server/api/admin/files/index.post.ts (garde-fou Content-Length avant lecture)
// - nuxt.config.ts (security.requestSizeLimiter de nuxt-security, middleware global qui
//   s'exécute AVANT le handler : doit autoriser au moins cette taille, sous peine de
//   rejeter en 413 des uploads pourtant valides).
// Un seul endroit à changer si la limite évolue.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 Mo
export const MULTIPART_OVERHEAD_BYTES = 64 * 1024
