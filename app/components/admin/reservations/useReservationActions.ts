// Mutation en ligne des réservations (statut uniquement, comme le prototype). Toast de retour
// ici, rechargement délégué à `onChanged` APRÈS le succès (un échec de rechargement ne
// transforme pas un succès en erreur). Sur échec du PATCH (409 conflit d'index, 404, 400),
// la liste est rechargée : le Select piloté par le DTO revient à la valeur serveur.
import { ref, type Ref } from 'vue'
import { toast } from 'vue-sonner'
import type { StatutReservationDto } from '#shared/types/admin'
import { toAdminError } from '@/utils/admin-error'
import { handleAdminUnauthorized, isAdminUnauthorized } from '@/utils/admin-unauthorized'

type JsonFetch = <T>(url: string, opts: { method: string; body?: unknown }) => Promise<T>
const jsonFetch = $fetch as unknown as JsonFetch

const BASE = '/api/admin/reservations'

export interface UseReservationActionsReturn {
  /** uuid de la réservation pendant une mise à jour en ligne (statut). */
  readonly busyUuid: Readonly<Ref<string | null>>
  updateStatut(uuid: string, statut: StatutReservationDto): Promise<void>
}

export function useReservationActions(onChanged: () => Promise<void>): UseReservationActionsReturn {
  const busyUuid = ref<string | null>(null)

  async function reload(): Promise<void> {
    try {
      await onChanged()
    } catch {
      // La liste expose sa propre erreur (AdminListState) : la mutation, elle, a réussi.
    }
  }

  return {
    busyUuid,
    updateStatut: async (uuid, statut) => {
      if (busyUuid.value !== null) return
      busyUuid.value = uuid
      try {
        try {
          await jsonFetch(`${BASE}/${encodeURIComponent(uuid)}`, { method: 'PATCH', body: { statut } })
        } catch (e) {
          if (isAdminUnauthorized(e)) {
            await handleAdminUnauthorized()
            return
          }
          toast.error(toAdminError(e).message)
          // Le Select reste piloté par le DTO : on recharge pour afficher la valeur serveur.
          await reload()
          return
        }
        toast.success('Réservation mise à jour.')
        await reload()
      } finally {
        busyUuid.value = null
      }
    },
  }
}
