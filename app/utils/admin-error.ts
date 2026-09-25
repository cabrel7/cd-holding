// Normalise toute erreur de mutation/chargement admin (ofetch/$fetch, validation uuid
// locale) en `AdminError` affichable — jamais de détail technique (voir CLAUDE.md § Erreurs).
// Utilisé par `useAdminResource` (T4) ; le composable ne lance pas de toast lui-même,
// c'est aux composants (CmsCollectionEditor, CmsSectionsEditor) de le faire avec ce message.
import type { AdminError } from '#shared/types/admin'

const GENERIC_MESSAGE = 'Une erreur est survenue. Réessayez.'

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
  return error.statusMessage ?? error.data?.statusMessage ?? error.data?.message
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
