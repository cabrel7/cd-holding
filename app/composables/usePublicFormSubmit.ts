// Envoi générique des formulaires de contact publics (spec docs/specs/phase3-holding-contact.md
// §4.2, extension multipart docs/specs/lot3-pages-specifiques.md §4). Ne lance jamais de toast
// (composable testable, comme useAdminResource) : c'est au composant appelant de traduire
// `PublicSubmitResult` en toast et de conserver les valeurs saisies en cas d'échec (machine
// d'états §4.3). Ne rejette jamais : toute erreur, y compris réseau, devient un
// `PublicSubmitResult` `ok: false`.
// `TBody` accepte aussi `FormData` (candidature : fichiers) — $fetch/ofetch détecte une instance
// FormData et laisse le navigateur poser le Content-Type multipart (boundary compris), sans
// JSON.stringify. Rétrocompatible : les appelants JSON existants (Record<string, unknown>) sont
// inchangés.
import { ref, type Ref } from 'vue'

const HTTP_BAD_REQUEST = 400
const HTTP_NOT_FOUND = 404
const HTTP_PAYLOAD_TOO_LARGE = 413
const HTTP_UNSUPPORTED_MEDIA_TYPE = 415
const HTTP_TOO_MANY_REQUESTS = 429

export type PublicSubmitResult =
  | { readonly ok: true }
  | {
      readonly ok: false
      readonly raison: 'validation' | 'trop-de-requetes' | 'erreur' | 'introuvable' | 'fichier'
      readonly retryAfterSeconds: number | null
    }

interface PublicFetchError {
  readonly status?: number
  readonly statusCode?: number
  readonly response?: { readonly headers?: { get(name: string): string | null } }
}

function isPublicFetchError(value: unknown): value is PublicFetchError {
  return typeof value === 'object' && value !== null
}

function extractStatus(error: PublicFetchError): number {
  return error.status ?? error.statusCode ?? 0
}

function extractRetryAfterSeconds(error: PublicFetchError): number | null {
  const header = error.response?.headers?.get('Retry-After')
  if (!header) return null
  const seconds = Number(header)
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null
}

export interface UsePublicFormSubmitReturn<TBody extends Record<string, unknown> | FormData> {
  envoyer(body: TBody): Promise<PublicSubmitResult>
  readonly envoiEnCours: Readonly<Ref<boolean>>
  /** Vrai dès l'entrée du handler enveloppé par `soumettre` (avant la validation async). */
  readonly verrouille: Readonly<Ref<boolean>>
  /** Enveloppe le handler de soumission d'un formulaire : verrou synchrone posé avant toute
   * validation, relâché en finally. Un déclenchement pendant le verrou est ignoré (le submit
   * natif est neutralisé). */
  soumettre<TArgs extends unknown[]>(
    handler: (...args: TArgs) => Promise<unknown>,
  ): (...args: TArgs) => Promise<void>
}

/** POST JSON (ou FormData) générique vers un endpoint `/api/public/*` — pipeline serveur commun
 * §3.2. Un corps `FormData` sert au formulaire de candidature (CV + documents, lot 3). */
export function usePublicFormSubmit<TBody extends Record<string, unknown> | FormData>(
  endpoint: `/api/public/${string}`,
): UsePublicFormSubmitReturn<TBody> {
  const envoiEnCours = ref(false)
  const verrouille = ref(false)

  function soumettre<TArgs extends unknown[]>(
    handler: (...args: TArgs) => Promise<unknown>,
  ): (...args: TArgs) => Promise<void> {
    return async (...args: TArgs): Promise<void> => {
      if (verrouille.value) {
        const [premier] = args
        if (premier instanceof Event) premier.preventDefault()
        return
      }
      verrouille.value = true
      try {
        await handler(...args)
      } finally {
        verrouille.value = false
      }
    }
  }

  async function envoyer(body: TBody): Promise<PublicSubmitResult> {
    envoiEnCours.value = true
    try {
      await $fetch(endpoint, { method: 'POST', body })
      return { ok: true }
    } catch (error) {
      if (!isPublicFetchError(error)) {
        return { ok: false, raison: 'erreur', retryAfterSeconds: null }
      }

      const status = extractStatus(error)
      if (status === HTTP_TOO_MANY_REQUESTS) {
        return { ok: false, raison: 'trop-de-requetes', retryAfterSeconds: extractRetryAfterSeconds(error) }
      }
      if (status === HTTP_NOT_FOUND) {
        return { ok: false, raison: 'introuvable', retryAfterSeconds: null }
      }
      if (status === HTTP_PAYLOAD_TOO_LARGE || status === HTTP_UNSUPPORTED_MEDIA_TYPE) {
        return { ok: false, raison: 'fichier', retryAfterSeconds: null }
      }
      if (status === HTTP_BAD_REQUEST) {
        return { ok: false, raison: 'validation', retryAfterSeconds: null }
      }
      return { ok: false, raison: 'erreur', retryAfterSeconds: null }
    } finally {
      envoiEnCours.value = false
    }
  }

  return {
    envoyer,
    envoiEnCours: envoiEnCours as Readonly<Ref<boolean>>,
    verrouille: verrouille as Readonly<Ref<boolean>>,
    soumettre,
  }
}
