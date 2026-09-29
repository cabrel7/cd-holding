// Mutations client (création, édition, suppression). Toast de retour ici ; rechargement de la
// liste délégué à `onChanged`. Une erreur (ex. 409 courriel existant) laisse le dialog ouvert.
import { ref, type Ref } from 'vue'
import { toast } from 'vue-sonner'
import type { ClientCreateInput, ClientUpdateInput } from '#shared/validation/admin'
import { toAdminError } from '@/utils/admin-error'

type JsonFetch = <T>(url: string, opts: { method: string; body?: unknown }) => Promise<T>
const jsonFetch = $fetch as unknown as JsonFetch

export interface UseClientActionsReturn {
  readonly submitting: Readonly<Ref<boolean>>
  create(payload: ClientCreateInput): Promise<boolean>
  update(uuid: string, payload: ClientUpdateInput): Promise<boolean>
  remove(uuid: string): Promise<boolean>
}

export function useClientActions(onChanged: () => Promise<void>): UseClientActionsReturn {
  const submitting = ref(false)

  async function run(action: () => Promise<void>, succes: string): Promise<boolean> {
    if (submitting.value) return false
    submitting.value = true
    try {
      await action()
      toast.success(succes)
    } catch (e) {
      toast.error(toAdminError(e).message)
      return false
    } finally {
      submitting.value = false
    }
    await onChanged()
    return true
  }

  return {
    submitting,
    create: (payload) => run(() => jsonFetch('/api/admin/clients', { method: 'POST', body: payload }), 'Client ajouté.'),
    update: (uuid, payload) =>
      run(() => jsonFetch(`/api/admin/clients/${encodeURIComponent(uuid)}`, { method: 'PATCH', body: payload }), 'Client mis à jour.'),
    remove: (uuid) =>
      run(() => jsonFetch(`/api/admin/clients/${encodeURIComponent(uuid)}`, { method: 'DELETE' }), 'Client supprimé.'),
  }
}
