// Mutations du vivier (création, édition, statut en ligne, suppression). Toast de retour ici,
// rechargement délégué à `onChanged` APRÈS le succès (un échec de rechargement ne transforme pas
// un succès en erreur). Un conflit 409 (courriel déjà présent) est exposé dans `emailError` pour
// s'afficher sous le champ, formulaire ouvert.
import { ref, type Ref } from 'vue'
import { toast } from 'vue-sonner'
import type { StatutCandidatDto } from '#shared/types/admin'
import type { CandidatCreateInput, CandidatUpdateInput } from '#shared/validation/placement'
import { toAdminError } from '@/utils/admin-error'
import { handleAdminUnauthorized, isAdminUnauthorized } from '@/utils/admin-unauthorized'

type JsonFetch = <T>(url: string, opts: { method: string; body?: unknown }) => Promise<T>
const jsonFetch = $fetch as unknown as JsonFetch

const BASE = '/api/admin/placement/candidats'
const CONFLICT_STATUS = 409

export interface UseCandidatActionsReturn {
  readonly submitting: Readonly<Ref<boolean>>
  /** uuid du candidat pendant une mise à jour en ligne (statut). */
  readonly busyUuid: Readonly<Ref<string | null>>
  /** Message du conflit de courriel (409), à afficher sous le champ. */
  readonly emailError: Readonly<Ref<string | null>>
  clearFieldErrors(): void
  create(payload: CandidatCreateInput): Promise<boolean>
  update(uuid: string, payload: CandidatUpdateInput): Promise<boolean>
  updateStatut(uuid: string, statut: StatutCandidatDto): Promise<void>
  remove(uuid: string): Promise<boolean>
}

export function useCandidatActions(onChanged: () => Promise<void>): UseCandidatActionsReturn {
  const submitting = ref(false)
  const busyUuid = ref<string | null>(null)
  const emailError = ref<string | null>(null)

  async function reload(): Promise<void> {
    try {
      await onChanged()
    } catch {
      // La liste expose sa propre erreur (AdminListState) : la mutation, elle, a réussi.
    }
  }

  async function runSubmit(
    request: () => Promise<unknown>,
    succes: string,
    conflictOnEmail: boolean,
  ): Promise<boolean> {
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

  async function runInline(uuid: string, request: () => Promise<unknown>, succes: string): Promise<boolean> {
    if (busyUuid.value !== null) return false
    busyUuid.value = uuid
    try {
      try {
        await request()
      } catch (e) {
        if (isAdminUnauthorized(e)) await handleAdminUnauthorized()
        else toast.error(toAdminError(e).message)
        return false
      }
      toast.success(succes)
      await reload()
      return true
    } finally {
      busyUuid.value = null
    }
  }

  const url = (uuid: string): string => `${BASE}/${encodeURIComponent(uuid)}`

  return {
    submitting,
    busyUuid,
    emailError,
    clearFieldErrors: () => {
      emailError.value = null
    },
    create: (payload) => runSubmit(() => jsonFetch(BASE, { method: 'POST', body: payload }), 'Candidat ajouté.', true),
    update: (uuid, payload) => runSubmit(() => jsonFetch(url(uuid), { method: 'PATCH', body: payload }), 'Candidat mis à jour.', true),
    updateStatut: async (uuid, statut) => {
      await runInline(uuid, () => jsonFetch(url(uuid), { method: 'PATCH', body: { statut } }), 'Statut du candidat mis à jour.')
    },
    remove: (uuid) => runSubmit(() => jsonFetch(url(uuid), { method: 'DELETE' }), 'Candidat supprimé.', false),
  }
}
