// Normalise toute erreur de mutation/chargement admin (ofetch/$fetch, validation uuid
// locale) en `AdminError` affichable — jamais de détail technique (voir CLAUDE.md § Erreurs).
// Utilisé par `useAdminResource` (T4) ; le composable ne lance pas de toast lui-même,
// c'est aux composants (CmsCollectionEditor, CmsSectionsEditor) de le faire avec ce message.
import type { AdminError } from '#shared/types/admin'

/** Message de repli affichable — jamais de détail technique (CLAUDE.md § Erreurs). */
export const ADMIN_ERROR_GENERIC_MESSAGE = 'Une erreur est survenue. Réessayez.'
const GENERIC_MESSAGE = ADMIN_ERROR_GENERIC_MESSAGE

interface FetchLikeError {
  readonly statusCode?: number
  readonly status?: number
  readonly statusMessage?: string
  readonly data?: { readonly statusMessage?: string; readonly message?: string }
}

function isFetchLikeError(value: unknown): value is FetchLikeError {
  return typeof value === 'object' && value !== null
}

function extractStatus(error: FetchLikeError): number {
  return error.statusCode ?? error.status ?? 0
}

function extractMessage(error: FetchLikeError): string | undefined {
  // Corps JSON d'abord : la ligne de statut HTTP (`statusMessage` d'ofetch) perd les caractères
  // non ASCII (« déjà » -> « dj »), le corps est fidèle.
  return error.data?.statusMessage ?? error.data?.message ?? error.statusMessage
}

/** Erreur 4xx → message générique du serveur (déjà affichable, voir CLAUDE.md). Sinon repli générique. */
export function toAdminError(error: unknown): AdminError {
  if (!isFetchLikeError(error)) {
    return { message: GENERIC_MESSAGE, status: 0 }
  }

  const status = extractStatus(error)
  if (status >= 400 && status < 500) {
    const message = extractMessage(error)
    if (message) {
      return { message, status }
    }
  }

  return { message: GENERIC_MESSAGE, status }
}
