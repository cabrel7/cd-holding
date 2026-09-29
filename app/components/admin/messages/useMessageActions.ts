// Mutations d'un message (statut, conversion en client, suppression). Le retour utilisateur
// (toast) est ici ; le rechargement de la liste et du compteur est délégué à `onChanged`.
import { ref, type Ref } from 'vue'
import { toast } from 'vue-sonner'
import type { StatutMessageDto } from '#shared/types/admin'
import { toAdminError } from '@/utils/admin-error'

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

export function useMessageActions(onChanged: () => Promise<void>): UseMessageActionsReturn {
  const busyUuid = ref<string | null>(null)

  async function run(uuid: string, action: () => Promise<boolean>): Promise<boolean> {
    if (busyUuid.value !== null) return false
    busyUuid.value = uuid
    try {
      const changed = await action()
      if (changed) await onChanged()
      return true
    } catch (e) {
      toast.error(toAdminError(e).message)
      return false
    } finally {
      busyUuid.value = null
    }
  }

  async function updateStatut(uuid: string, statut: StatutMessageDto): Promise<void> {
    await run(uuid, async () => {
      await jsonFetch(`/api/admin/messages/${encodeURIComponent(uuid)}`, { method: 'PATCH', body: { statut } })
      toast.success('Statut mis à jour.')
      return true
    })
  }

  async function addToClients(uuid: string): Promise<void> {
    if (busyUuid.value !== null) return
    busyUuid.value = uuid
    try {
      await jsonFetch(`/api/admin/messages/${encodeURIComponent(uuid)}/client`, { method: 'POST' })
      toast.success('Contact ajouté aux clients.')
    } catch (e) {
      const error = toAdminError(e)
      if (error.status === CONFLICT_STATUS) toast.info(error.message)
      else toast.error(error.message)
    } finally {
      busyUuid.value = null
    }
  }

  async function remove(uuid: string): Promise<boolean> {
    let deleted = false
    await run(uuid, async () => {
      await jsonFetch(`/api/admin/messages/${encodeURIComponent(uuid)}`, { method: 'DELETE' })
      toast.success('Message supprimé.')
      deleted = true
      return true
    })
    return deleted
  }

  return { busyUuid, updateStatut, addToClients, remove }
}
