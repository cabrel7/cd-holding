// Session admin expirée (401 sur un appel /api/admin/**). Ne pas se contenter de naviguer vers
// la connexion : `loggedIn` resterait vrai et le middleware renverrait vers la cible, qui
// répondrait 401 à nouveau (boucle). On vide donc la session ET le cache admin, puis on navigue.
import { watch, type Ref } from 'vue'
import { toAdminError } from '@/utils/admin-error'

export const ADMIN_CACHE_PREFIX = 'admin-'
const HTTP_UNAUTHORIZED = 401

/** Vide toutes les données admin en cache (clés `admin-*`) : rien ne fuit vers le compte suivant. */
export function clearAdminCache(): void {
  clearNuxtData((key) => key.startsWith(ADMIN_CACHE_PREFIX))
}

export function isAdminUnauthorized(error: unknown): boolean {
  return toAdminError(error).status === HTTP_UNAUTHORIZED
}

let inFlight: Promise<void> | null = null

/** Idempotent : plusieurs 401 simultanés (liste, compteurs, sites) ne déclenchent qu'une navigation. */
export function handleAdminUnauthorized(): Promise<void> {
  if (inFlight) return inFlight
  inFlight = (async () => {
    const router = useRouter()
    const redirect = router.currentRoute.value.fullPath
    const { clear, session } = useUserSession()
    try {
      await clear()
    } catch {
      // Le serveur est peut-être injoignable : on invalide au moins l'état local pour éviter la boucle.
      session.value = null
    }
    clearAdminCache()
    // Forme servie sur l'hôte courant (D8) : comparaison et cible normalisées.
    if (toAdminPath(router.currentRoute.value.path) === toAdminPath(ADMIN_LOGIN_PATH)) return
    await navigateTo({ path: toAdminPath(ADMIN_LOGIN_PATH), query: { redirect } })
  })().finally(() => {
    inFlight = null
  })
  return inFlight
}

/** Déclenche `handleAdminUnauthorized` quand l'erreur d'un `useFetch` passe à 401. */
export function watchAdminUnauthorized(error: Readonly<Ref<unknown>>): void {
  watch(
    error,
    (value) => {
      if (value && isAdminUnauthorized(value)) void handleAdminUnauthorized()
    },
    // `immediate` : après un `await useFetch(...)`, l'erreur 401 est déjà écrite à
    // l'enregistrement du watcher — sans ça, la transition n'est jamais observée.
    { immediate: true },
  )
}
