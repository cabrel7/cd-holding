// Mutations client (création, édition, suppression). Toast de retour ici ; rechargement de la
// liste délégué à `onChanged`, exécuté APRÈS le succès (un échec de rechargement ne transforme
// pas un succès en erreur). Un conflit 409 (courriel existant) est exposé dans `emailError` pour
// s'afficher sous le champ, dialog ouvert ; toast réservé aux erreurs serveur/réseau.
import { ref, type Ref } from 'vue'
import { toast } from 'vue-sonner'
import type { ClientCreateInput, ClientUpdateInput } from '#shared/validation/admin'
import { toAdminError } from '@/utils/admin-error'
import { handleAdminUnauthorized, isAdminUnauthorized } from '@/utils/admin-unauthorized'

type JsonFetch = <T>(url: string, opts: { method: string; body?: unknown }) => Promise<T>
const jsonFetch = $fetch as unknown as JsonFetch

const CONFLICT_STATUS = 409

export interface UseClientActionsReturn {
  readonly submitting: Readonly<Ref<boolean>>
  /** Message du conflit de courriel (409), à afficher sous le champ. */
  readonly emailError: Readonly<Ref<string | null>>
  clearFieldErrors(): void
  create(payload: ClientCreateInput): Promise<boolean>
  update(uuid: string, payload: ClientUpdateInput): Promise<boolean>
  remove(uuid: string): Promise<boolean>
}

export function useClientActions(onChanged: () => Promise<void>): UseClientActionsReturn {
  const submitting = ref(false)
  const emailError = ref<string | null>(null)

  async function reload(): Promise<void> {
    try {
      await onChanged()
    } catch {
      // La liste expose sa propre erreur (AdminListState) : la mutation, elle, a réussi.
    }
  }

  async function run(request: () => Promise<unknown>, succes: string, conflictOnEmail: boolean): Promise<boolean> {
    if (submitting.value) return false
    submitting.value = true
    emailError.value = null
    try {
      try {
        await request()
      } catch (e) {
        if (isAdminUnauthorized(e)) {
          await handleAdminUnauthorized()
          return false
        }
        const error = toAdminError(e)
        if (conflictOnEmail && error.status === CONFLICT_STATUS) emailError.value = error.message
        else toast.error(error.message)
        return false
      }
      toast.success(succes)
      await reload()
      return true
    } finally {
      submitting.value = false
    }
  }

  const url = (uuid: string): string => `/api/admin/clients/${encodeURIComponent(uuid)}`

  return {
    submitting,
    emailError,
    clearFieldErrors: () => {
      emailError.value = null
    },
    create: (payload) => run(() => jsonFetch('/api/admin/clients', { method: 'POST', body: payload }), 'Client ajouté.', true),
    update: (uuid, payload) => run(() => jsonFetch(url(uuid), { method: 'PATCH', body: payload }), 'Client mis à jour.', true),
    remove: (uuid) => run(() => jsonFetch(url(uuid), { method: 'DELETE' }), 'Client supprimé.', false),
  }
}
