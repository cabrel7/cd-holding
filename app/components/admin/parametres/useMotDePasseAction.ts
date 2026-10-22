// Changement du mot de passe du compte connecté (spec lot 5 §5). Miroir de `useDossierActions` :
// toast de retour ici, fermeture du dialog déléguée à la page APRÈS le succès. Le seul 400 mappé
// sous le champ est « Mot de passe actuel incorrect » ; tout autre 400 (zod serveur, requête
// retouchée) part en toast pour ne pas l'attribuer au mauvais champ.
import { ref, type Ref } from 'vue'
import { toast } from 'vue-sonner'
import { MESSAGE_ACTUEL_INCORRECT, MESSAGE_RATE_LIMIT_TENTATIVES } from '#shared/config/admin'
import { ADMIN_ERROR_GENERIC_MESSAGE, toAdminError } from '@/utils/admin-error'
import { handleAdminUnauthorized, isAdminUnauthorized } from '@/utils/admin-unauthorized'

type JsonFetch = <T>(url: string, opts: { method: string; body?: unknown }) => Promise<T>
const jsonFetch = $fetch as unknown as JsonFetch

const BASE = '/api/admin/profil/mot-de-passe'
const HTTP_BAD_REQUEST = 400
const HTTP_TOO_MANY_REQUESTS = 429

/** Valeurs du dialog. `confirmation` n'est JAMAIS transmise : le schéma serveur est `.strict()`. */
export interface MotDePasseValeurs {
  readonly actuel: string
  readonly nouveau: string
  readonly confirmation: string
}

export interface UseMotDePasseActionReturn {
  readonly submitting: Readonly<Ref<boolean>>
  /** Message 400 du serveur (« Mot de passe actuel incorrect »), à afficher sous le champ. */
  readonly actuelError: Readonly<Ref<string | null>>
  clearFieldErrors(): void
  changer(valeurs: MotDePasseValeurs): Promise<boolean>
}

export function useMotDePasseAction(): UseMotDePasseActionReturn {
  const submitting = ref(false)
  const actuelError = ref<string | null>(null)

  async function changer(valeurs: MotDePasseValeurs): Promise<boolean> {
    if (submitting.value) return false
    submitting.value = true
    actuelError.value = null
    try {
      // Seul endroit où le corps est construit : `confirmation` est retirée avant le POST.
      const body = { actuel: valeurs.actuel, nouveau: valeurs.nouveau }
      try {
        await jsonFetch(BASE, { method: 'POST', body })
      } catch (e) {
        if (isAdminUnauthorized(e)) {
          await handleAdminUnauthorized()
          return false
        }
        const error = toAdminError(e)
        if (error.status === HTTP_BAD_REQUEST && error.message === MESSAGE_ACTUEL_INCORRECT) {
          actuelError.value = error.message
        } else if (error.status === HTTP_TOO_MANY_REQUESTS) {
          toast.error(MESSAGE_RATE_LIMIT_TENTATIVES)
        } else if (error.status === HTTP_BAD_REQUEST) {
          // 400 zod/serveur quelconque : son statutMessage n'est pas un message de champ.
          toast.error(ADMIN_ERROR_GENERIC_MESSAGE)
        } else {
          toast.error(error.message)
        }
        return false
      }
      toast.success('Mot de passe modifié.')
      return true
    } finally {
      submitting.value = false
    }
  }

  return {
    submitting,
    actuelError,
    clearFieldErrors: () => {
      actuelError.value = null
    },
    changer,
  }
}
