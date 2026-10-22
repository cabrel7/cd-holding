// Mutations dossiers comptables (création, édition, suppression). Toast de retour ici,
// rechargement délégué à `onChanged` APRÈS le succès (un échec de rechargement ne transforme pas
// un succès en erreur). Un conflit 409 (courriel déjà présent) est exposé dans `emailError` pour
// s'afficher sous le champ, formulaire ouvert.
import { ref, type Ref } from 'vue'
import { toast } from 'vue-sonner'
import type { DossierCreateInput, DossierUpdateInput } from '#shared/validation/comptable'
import { toAdminError } from '@/utils/admin-error'
import { handleAdminUnauthorized, isAdminUnauthorized } from '@/utils/admin-unauthorized'

type JsonFetch = <T>(url: string, opts: { method: string; body?: unknown }) => Promise<T>
const jsonFetch = $fetch as unknown as JsonFetch

const BASE = '/api/admin/comptable/dossiers'
const CONFLICT_STATUS = 409

export interface UseDossierActionsReturn {
  readonly submitting: Readonly<Ref<boolean>>
  /** Message du conflit de courriel (409), à afficher sous le champ. */
  readonly emailError: Readonly<Ref<string | null>>
  clearFieldErrors(): void
  create(payload: DossierCreateInput): Promise<boolean>
  update(uuid: string, payload: DossierUpdateInput): Promise<boolean>
  remove(uuid: string): Promise<boolean>
}

export function useDossierActions(onChanged: () => Promise<void>): UseDossierActionsReturn {
  const submitting = ref(false)
  const emailError = ref<string | null>(null)

  async function reload(): Promise<void> {
    try {
      await onChanged()
    } catch {
      // La liste expose sa propre erreur (AdminListState) : la mutation, elle, a réussi.
    }
  }

  async function runSubmit(request: () => Promise<unknown>, succes: string, conflictOnEmail: boolean): Promise<boolean> {
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

  const url = (uuid: string): string => `${BASE}/${encodeURIComponent(uuid)}`

  return {
    submitting,
    emailError,
    clearFieldErrors: () => {
      emailError.value = null
    },
    create: (payload) => runSubmit(() => jsonFetch(BASE, { method: 'POST', body: payload }), 'Dossier ajouté.', true),
    update: (uuid, payload) => runSubmit(() => jsonFetch(url(uuid), { method: 'PATCH', body: payload }), 'Dossier mis à jour.', true),
    remove: (uuid) => runSubmit(() => jsonFetch(url(uuid), { method: 'DELETE' }), 'Dossier supprimé.', false),
  }
}
