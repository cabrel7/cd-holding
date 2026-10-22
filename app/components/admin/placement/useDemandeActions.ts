// Mutations des demandes clientes : CRUD, statut en ligne, publication/dépublication d'offre,
// affectation et retrait de candidats. Le rechargement de la liste suit chaque succès (les
// correspondants et affectations sont recalculés par le serveur et renvoyés avec la demande).
import { ref, type Ref } from 'vue'
import { toast } from 'vue-sonner'
import type { StatutDemandeDto, TypeContratDto } from '#shared/types/admin'
import type { DemandeCreateInput, DemandeUpdateInput } from '#shared/validation/placement'
import { toAdminError } from '@/utils/admin-error'
import { handleAdminUnauthorized, isAdminUnauthorized } from '@/utils/admin-unauthorized'

type JsonFetch = <T>(url: string, opts: { method: string; body?: unknown }) => Promise<T>
const jsonFetch = $fetch as unknown as JsonFetch

const BASE = '/api/admin/placement/demandes'

/** Champs d'offre envoyés avec `publiee: true` (le reste du corps est figé ici). */
export interface OffreInput {
  readonly titreOffre: string
  readonly lieu: string
  readonly typeContrat: TypeContratDto
  readonly salaire?: string | null
  readonly descriptionPublique: string
}

export interface UseDemandeActionsReturn {
  readonly submitting: Readonly<Ref<boolean>>
  /** uuid de la demande pendant une action en ligne (statut, publication, affectation…). */
  readonly busyUuid: Readonly<Ref<string | null>>
  create(payload: DemandeCreateInput): Promise<boolean>
  update(uuid: string, payload: DemandeUpdateInput): Promise<boolean>
  remove(uuid: string): Promise<boolean>
  updateStatut(uuid: string, statut: StatutDemandeDto): Promise<void>
  publier(uuid: string, offre: OffreInput): Promise<boolean>
  depublier(uuid: string): Promise<boolean>
  assigner(uuid: string, candidatUuid: string): Promise<void>
  retirerAffectation(uuid: string, affectationUuid: string): Promise<void>
}

export function useDemandeActions(onChanged: () => Promise<void>): UseDemandeActionsReturn {
  const submitting = ref(false)
  const busyUuid = ref<string | null>(null)

  async function reload(): Promise<void> {
    try {
      await onChanged()
    } catch {
      // La liste expose sa propre erreur : la mutation, elle, a réussi.
    }
  }

  async function runSubmit(request: () => Promise<unknown>, succes: string): Promise<boolean> {
    if (submitting.value) return false
    submitting.value = true
    try {
      try {
        await request()
      } catch (e) {
        if (isAdminUnauthorized(e)) {
          await handleAdminUnauthorized()
          return false
        }
        toast.error(toAdminError(e).message)
        return false
      }
      toast.success(succes)
      await reload()
      return true
    } finally {
      submitting.value = false
    }
  }

  async function runInline(
    uuid: string,
    request: () => Promise<unknown>,
    succes: string,
    options: { readonly reload?: boolean } = {},
  ): Promise<boolean> {
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
      if (options.reload !== false) await reload()
      return true
    } finally {
      busyUuid.value = null
    }
  }

  const url = (uuid: string): string => `${BASE}/${encodeURIComponent(uuid)}`

  return {
    submitting,
    busyUuid,
    create: (payload) => runSubmit(() => jsonFetch(BASE, { method: 'POST', body: payload }), 'Demande ajoutée.'),
    update: (uuid, payload) => runSubmit(() => jsonFetch(url(uuid), { method: 'PATCH', body: payload }), 'Demande mise à jour.'),
    remove: (uuid) => runSubmit(() => jsonFetch(url(uuid), { method: 'DELETE' }), 'Demande supprimée.'),
    updateStatut: async (uuid, statut) => {
      await runInline(uuid, () => jsonFetch(url(uuid), { method: 'PATCH', body: { statut } }), 'Statut de la demande mis à jour.')
    },
    publier: (uuid, offre) =>
      runInline(uuid, () => jsonFetch(url(uuid), { method: 'PATCH', body: { publiee: true, ...offre } }), 'Offre publiée.'),
    depublier: (uuid) => runInline(uuid, () => jsonFetch(url(uuid), { method: 'PATCH', body: { publiee: false } }), 'Offre retirée.'),
    assigner: async (uuid, candidatUuid) => {
      await runInline(
        uuid,
        () => jsonFetch(`${url(uuid)}/affectations`, { method: 'POST', body: { candidatUuid } }),
        'Candidat assigné à la demande.',
      )
    },
    retirerAffectation: async (uuid, affectationUuid) => {
      await runInline(
        uuid,
        () => jsonFetch(`${url(uuid)}/affectations/${encodeURIComponent(affectationUuid)}`, { method: 'DELETE' }),
        'Affectation retirée.',
      )
    },
  }
}
