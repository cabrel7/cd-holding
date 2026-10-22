// Mutations des candidatures : statut en ligne, ajout au vivier (copie du CV côté serveur),
// anonymisation Loi 25 (« Supprimer maintenant ») et suppression. Le rechargement suit chaque
// succès. Un 409 sur l'ajout au vivier (courriel déjà présent) est informatif, pas une erreur.
// Toutes les actions ciblent une candidature : `busyUuid` porte l'état par ligne.
import { ref, type Ref } from 'vue'
import { toast } from 'vue-sonner'
import type { AdminError, StatutCandidatureDto } from '#shared/types/admin'
import { toAdminError } from '@/utils/admin-error'
import { handleAdminUnauthorized, isAdminUnauthorized } from '@/utils/admin-unauthorized'

type JsonFetch = <T>(url: string, opts: { method: string; body?: unknown }) => Promise<T>
const jsonFetch = $fetch as unknown as JsonFetch

const BASE = '/api/admin/placement/candidatures'
const CONFLICT_STATUS = 409

export interface UseCandidatureActionsReturn {
  readonly submitting: Readonly<Ref<boolean>>
  /** uuid de la candidature pendant une action (statut, vivier, anonymisation, suppression). */
  readonly busyUuid: Readonly<Ref<string | null>>
  updateStatut(uuid: string, statut: StatutCandidatureDto): Promise<void>
  ajouterAuVivier(uuid: string): Promise<boolean>
  anonymiser(uuid: string): Promise<boolean>
  remove(uuid: string): Promise<boolean>
}

export function useCandidatureActions(onChanged: () => Promise<void>): UseCandidatureActionsReturn {
  const submitting = ref(false)
  const busyUuid = ref<string | null>(null)

  async function reload(): Promise<void> {
    try {
      await onChanged()
    } catch {
      // La liste expose sa propre erreur : la mutation, elle, a réussi.
    }
  }

  async function run(
    uuid: string,
    request: () => Promise<unknown>,
    succes: string,
    options: { readonly conflictAsInfo?: boolean } = {},
  ): Promise<boolean> {
    if (busyUuid.value !== null) return false
    busyUuid.value = uuid
    submitting.value = true
    try {
      try {
        await request()
      } catch (e) {
        if (isAdminUnauthorized(e)) {
          await handleAdminUnauthorized()
          return false
        }
        const error: AdminError = toAdminError(e)
        if (options.conflictAsInfo && error.status === CONFLICT_STATUS) toast.info(error.message)
        else toast.error(error.message)
        return false
      }
      toast.success(succes)
      await reload()
      return true
    } finally {
      submitting.value = false
      busyUuid.value = null
    }
  }

  const url = (uuid: string): string => `${BASE}/${encodeURIComponent(uuid)}`

  return {
    submitting,
    busyUuid,
    updateStatut: async (uuid, statut) => {
      await run(uuid, () => jsonFetch(url(uuid), { method: 'PATCH', body: { statut } }), 'Statut de la candidature mis à jour.')
    },
    ajouterAuVivier: (uuid) =>
      run(uuid, () => jsonFetch(`${url(uuid)}/vivier`, { method: 'POST' }), 'Candidat ajouté au vivier.', {
        conflictAsInfo: true,
      }),
    anonymiser: (uuid) => run(uuid, () => jsonFetch(`${url(uuid)}/anonymiser`, { method: 'POST' }), 'Candidature anonymisée.'),
    remove: (uuid) => run(uuid, () => jsonFetch(url(uuid), { method: 'DELETE' }), 'Candidature supprimée.'),
  }
}
