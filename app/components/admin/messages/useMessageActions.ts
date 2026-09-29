// Mutations d'un message (statut, conversion en client, suppression). Le retour utilisateur
// (toast) est ici ; le rechargement de la liste et du compteur est délégué à `onChanged`, exécuté
// APRÈS le succès de l'action : un échec de rechargement ne transforme pas un succès en erreur.
import { ref, type Ref } from 'vue'
import { toast } from 'vue-sonner'
import type { AdminError, StatutMessageDto } from '#shared/types/admin'
import { toAdminError } from '@/utils/admin-error'
import { handleAdminUnauthorized, isAdminUnauthorized } from '@/utils/admin-unauthorized'

// Même contournement que useAdminResource : URL dynamique → `$fetch` typé Nitro récursif.
type JsonFetch = <T>(url: string, opts: { method: string; body?: unknown }) => Promise<T>
const jsonFetch = $fetch as unknown as JsonFetch

const CONFLICT_STATUS = 409

export interface UseMessageActionsReturn {
  readonly busyUuid: Readonly<Ref<string | null>>
  updateStatut(uuid: string, statut: StatutMessageDto): Promise<void>
  addToClients(uuid: string): Promise<void>
  remove(uuid: string): Promise<boolean>
}

interface RunOptions {
  readonly request: () => Promise<unknown>
  readonly succes: string
  /** Relance la liste/le compteur après succès (faux quand l'action ne change pas les messages). */
  readonly reload: boolean
  /** Erreur traitée par l'appelant (ex. conflit) ; retourne `true` si gérée. */
  readonly handleError?: (error: AdminError) => boolean
}

export function useMessageActions(onChanged: () => Promise<void>): UseMessageActionsReturn {
  const busyUuid = ref<string | null>(null)

  async function reload(): Promise<void> {
    try {
      await onChanged()
    } catch {
      // La liste expose sa propre erreur (AdminListState) : l'action, elle, a réussi.
    }
  }

  /** `true` si l'action a réussi. */
  async function run(uuid: string, options: RunOptions): Promise<boolean> {
    if (busyUuid.value !== null) return false
    busyUuid.value = uuid
    try {
      try {
        await options.request()
      } catch (e) {
        if (isAdminUnauthorized(e)) await handleAdminUnauthorized()
        else {
          const error = toAdminError(e)
          if (!options.handleError?.(error)) toast.error(error.message)
        }
        return false
      }
      toast.success(options.succes)
      if (options.reload) await reload()
      return true
    } finally {
      busyUuid.value = null
    }
  }

  const url = (uuid: string): string => `/api/admin/messages/${encodeURIComponent(uuid)}`

  async function updateStatut(uuid: string, statut: StatutMessageDto): Promise<void> {
    await run(uuid, {
      request: () => jsonFetch(url(uuid), { method: 'PATCH', body: { statut } }),
      succes: 'Statut mis à jour.',
      reload: true,
    })
  }

  async function addToClients(uuid: string): Promise<void> {
    await run(uuid, {
      request: () => jsonFetch(`${url(uuid)}/client`, { method: 'POST' }),
      succes: 'Contact ajouté aux clients.',
      reload: false,
      handleError: (error) => {
        if (error.status !== CONFLICT_STATUS) return false
        toast.info(error.message)
        return true
      },
    })
  }

  function remove(uuid: string): Promise<boolean> {
    return run(uuid, {
      request: () => jsonFetch(url(uuid), { method: 'DELETE' }),
      succes: 'Message supprimé.',
      reload: true,
    })
  }

  return { busyUuid, updateStatut, addToClients, remove }
}
