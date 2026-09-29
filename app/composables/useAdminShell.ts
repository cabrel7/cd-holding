import type { AdminSiteSummary } from '#shared/types/admin'
import { ROLES } from '#shared/utils/roles'

export const ADMIN_SITES_KEY = 'admin-sites'
export const ADMIN_COMPTEURS_KEY = 'admin-compteurs'

interface AdminCompteurs {
  readonly nouveaux: number
}

/**
 * Données du shell admin : sites accessibles (sélecteurs, modules) et compteur de messages non
 * lus. EMPLOYE : aucun appel (les routes correspondantes lui renvoient 403). Les clés useFetch
 * sont partagées : appeler ce composable depuis plusieurs composants ne déclenche qu'un fetch.
 * Un échec du compteur n'affiche ni badge ni toast (information secondaire).
 */
export function useAdminShell(): {
  sites: Readonly<Ref<readonly AdminSiteSummary[]>>
  compteurs: Readonly<Ref<AdminCompteurs | null>>
  refreshCompteurs: () => Promise<void>
} {
  const { user } = useUserSession()
  const actif = !!user.value && user.value.role !== ROLES.EMPLOYE

  const { data: sitesData } = useFetch<AdminSiteSummary[]>('/api/admin/sites', {
    key: ADMIN_SITES_KEY,
    server: false,
    immediate: actif,
    default: () => [],
  })
  const { data: compteursData } = useFetch<AdminCompteurs | null>('/api/admin/messages/compteurs', {
    key: ADMIN_COMPTEURS_KEY,
    server: false,
    immediate: actif,
    default: () => null,
  })

  const sites = computed<readonly AdminSiteSummary[]>(() => sitesData.value ?? [])
  const compteurs = computed<AdminCompteurs | null>(() => compteursData.value ?? null)

  async function refreshCompteurs(): Promise<void> {
    if (!actif) return
    await refreshNuxtData(ADMIN_COMPTEURS_KEY)
  }

  return { sites, compteurs, refreshCompteurs }
}
