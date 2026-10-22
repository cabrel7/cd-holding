// Mutations des quarts de planning : création, édition, suppression. Le rechargement de la
// semaine suit chaque succès (délégué à `onChanged`). Les dialogs restent ouverts tant que la
// requête n'a pas abouti : chaque fonction renvoie `true` seulement en cas de succès.
// `busyUuid` porte l'état par quart (boutons Modifier/Supprimer désactivés pendant l'appel).
import { ref, type Ref } from 'vue'
import { toast } from 'vue-sonner'
import type { PlanningSite } from '#shared/config/planning'
import type { QuartCreateInput, QuartUpdateInput } from '#shared/validation/planning'
import type { AdminError } from '#shared/types/admin'
import { toAdminError } from '@/utils/admin-error'
import { handleAdminUnauthorized, isAdminUnauthorized } from '@/utils/admin-unauthorized'

type JsonFetch = <T>(url: string, opts: { method: string; body?: unknown }) => Promise<T>
const jsonFetch = $fetch as unknown as JsonFetch

export interface UsePlanningActionsReturn {
  readonly submitting: Readonly<Ref<boolean>>
  /** uuid du quart pendant une mutation (création : '' — aucun bouton ciblé). */
  readonly busyUuid: Readonly<Ref<string | null>>
  create(payload: QuartCreateInput): Promise<boolean>
  update(uuid: string, payload: QuartUpdateInput): Promise<boolean>
  remove(uuid: string): Promise<boolean>
}

export function usePlanningActions(site: PlanningSite, onChanged: () => Promise<void>): UsePlanningActionsReturn {
  const submitting = ref(false)
  const busyUuid = ref<string | null>(null)

  const base = `/api/admin/planning/${site}`
  const url = (uuid: string): string => `${base}/${encodeURIComponent(uuid)}`

  async function reload(): Promise<void> {
    try {
      await onChanged()
    } catch {
      // La semaine expose sa propre erreur (AdminListState) : la mutation, elle, a réussi.
    }
  }

  async function run(uuid: string, request: () => Promise<unknown>, succes: string): Promise<boolean> {
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
        toast.error(error.message)
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

  return {
    submitting,
    busyUuid,
    create: (payload) => run('', () => jsonFetch(base, { method: 'POST', body: payload }), 'Quart ajouté.'),
    update: (uuid, payload) => run(uuid, () => jsonFetch(url(uuid), { method: 'PATCH', body: payload }), 'Quart mis à jour.'),
    remove: (uuid) => run(uuid, () => jsonFetch(url(uuid), { method: 'DELETE' }), 'Quart supprimé.'),
  }
}
