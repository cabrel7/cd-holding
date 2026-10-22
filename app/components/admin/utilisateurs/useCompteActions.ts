// Mutations des comptes (création, édition, réinitialisation de mot de passe, activation) —
// spec lot 6 §5. Miroir de `useClientActions` : toast de retour ici, rechargement de la liste
// délégué à `onChanged` APRÈS le succès (un échec de rechargement ne transforme pas un succès
// en erreur). Le 409 « courriel déjà utilisé » est exposé dans `emailError` pour s'afficher sous
// le champ, dialog ouvert ; les autres 409 (propre compte, dernier super administrateur) et tout
// autre 4xx partent en toast, le 429 avec le libellé de quota partagé. La création et la reset
// renvoient le mot de passe temporaire (généré serveur, affiché une seule fois, D14) : la page
// n'ouvre le dialog que sur ce résultat, donc seulement après le 201/200.
import { ref, type Ref } from 'vue'
import { toast } from 'vue-sonner'
import { MESSAGE_RATE_LIMIT_TENTATIVES } from '#shared/config/admin'
import type { AdminCompteDto } from '#shared/types/admin'
import type { UtilisateurCreateInput, UtilisateurUpdateInput } from '#shared/validation/utilisateurs'
import { toAdminError } from '@/utils/admin-error'
import { handleAdminUnauthorized, isAdminUnauthorized } from '@/utils/admin-unauthorized'

type JsonFetch = <T>(url: string, opts: { method: string; body?: unknown }) => Promise<T>
const jsonFetch = $fetch as unknown as JsonFetch

const BASE = '/api/admin/utilisateurs'
const CONFLICT_STATUS = 409
const TOO_MANY_REQUESTS = 429

/** 201 de POST /api/admin/utilisateurs. */
interface ReponseCreation {
  readonly compte: AdminCompteDto
  readonly motDePasseTemporaire: string
}

/** 200 de POST /api/admin/utilisateurs/[uuid]/mot-de-passe. */
interface ReponseMotDePasse {
  readonly motDePasseTemporaire: string
}

export interface UseCompteActionsReturn {
  readonly submitting: Readonly<Ref<boolean>>
  /** Message du conflit de courriel (409 à la création), à afficher sous le champ. */
  readonly emailError: Readonly<Ref<string | null>>
  clearFieldErrors(): void
  /** 201 → mot de passe temporaire à afficher une fois ; null = échec (dialog resté ouvert). */
  create(payload: UtilisateurCreateInput): Promise<string | null>
  update(uuid: string, payload: UtilisateurUpdateInput): Promise<boolean>
  /** 200 → nouveau mot de passe temporaire ; null = échec (ancien mot de passe toujours valide). */
  reinitialiserMotDePasse(uuid: string): Promise<string | null>
  setActif(uuid: string, actif: boolean): Promise<boolean>
}

export function useCompteActions(onChanged: () => Promise<void>): UseCompteActionsReturn {
  const submitting = ref(false)
  const emailError = ref<string | null>(null)

  async function reload(): Promise<void> {
    try {
      await onChanged()
    } catch {
      // La liste expose sa propre erreur (AdminListState) : la mutation, elle, a réussi.
    }
  }

  async function run<T>(
    request: () => Promise<T>,
    succes: string,
    options: { readonly conflictOnEmail?: boolean } = {},
  ): Promise<T | null> {
    if (submitting.value) return null
    submitting.value = true
    emailError.value = null
    try {
      let reponse: T
      try {
        reponse = await request()
      } catch (e) {
        if (isAdminUnauthorized(e)) {
          await handleAdminUnauthorized()
          return null
        }
        const error = toAdminError(e)
        if (options.conflictOnEmail === true && error.status === CONFLICT_STATUS) emailError.value = error.message
        else if (error.status === TOO_MANY_REQUESTS) toast.error(MESSAGE_RATE_LIMIT_TENTATIVES)
        else toast.error(error.message)
        return null
      }
      toast.success(succes)
      await reload()
      return reponse
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
    create: async (payload) => {
      const reponse = await run(() => jsonFetch<ReponseCreation>(BASE, { method: 'POST', body: payload }), 'Compte créé.', {
        conflictOnEmail: true,
      })
      return reponse?.motDePasseTemporaire ?? null
    },
    update: async (uuid, payload) => (await run(() => jsonFetch<AdminCompteDto>(url(uuid), { method: 'PATCH', body: payload }), 'Compte mis à jour.')) !== null,
    reinitialiserMotDePasse: async (uuid) => {
      const reponse = await run(
        () => jsonFetch<ReponseMotDePasse>(`${url(uuid)}/mot-de-passe`, { method: 'POST' }),
        'Mot de passe réinitialisé.',
      )
      return reponse?.motDePasseTemporaire ?? null
    },
    setActif: async (uuid, actif) =>
      (await run(
        () => jsonFetch<AdminCompteDto>(url(uuid), { method: 'PATCH', body: { actif } }),
        actif ? 'Compte réactivé.' : 'Compte désactivé.',
      )) !== null,
  }
}
