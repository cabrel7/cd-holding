// Filtres et pagination d'une liste admin, portés par l'URL (`route.query`) : survivent au
// rechargement et au retour arrière. Valeurs validées par le schéma zod partagé ; une valeur
// invalide est ignorée seule (défaut du schéma), les autres filtres sont conservés. Un changement
// de filtre remet `page` à 1 ; la recherche est temporisée (300 ms) pour ne pas requêter à
// chaque frappe.
import { computed, onScopeDispose, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { z } from 'zod'

export const ADMIN_SEARCH_DEBOUNCE_MS = 300

export interface AdminListQueryBase {
  readonly page: number
  readonly q?: string | undefined
}

export interface UseAdminListQueryReturn<TQuery extends AdminListQueryBase> {
  readonly query: ComputedRef<TQuery>
  readonly searchInput: Ref<string>
  readonly hasFilters: ComputedRef<boolean>
  setFilter(key: Exclude<keyof TQuery & string, 'page' | 'q'>, value: string | undefined): Promise<void>
  setPage(page: number): Promise<void>
  reset(): Promise<void>
}

export function useAdminListQuery<TQuery extends AdminListQueryBase>(
  schema: z.ZodType<TQuery, z.ZodTypeDef, unknown>,
  keys: readonly (keyof TQuery & string)[],
): UseAdminListQueryReturn<TQuery> {
  const route = useRoute()
  const router = useRouter()

  /** Valeurs de l'URL pour les clés gérées (première valeur, chaîne non vide). */
  function readUrl(): Record<string, string> {
    const out: Record<string, string> = {}
    for (const key of keys) {
      const raw = route.query[key]
      const value = Array.isArray(raw) ? raw[0] : raw
      if (typeof value === 'string' && value !== '') out[key] = value
    }
    return out
  }

  const query = computed<TQuery>(() => {
    // Un paramètre invalide n'annule que lui-même : on retire les clés en erreur et on réessaie.
    const raw = readUrl()
    for (let attempt = 0; attempt <= keys.length; attempt++) {
      const parsed = schema.safeParse(raw)
      if (parsed.success) return parsed.data
      const invalides = parsed.error.issues.map((issue) => String(issue.path[0] ?? '')).filter((key) => key in raw)
      if (invalides.length === 0) break
      for (const key of invalides) delete raw[key]
    }
    return schema.parse({})
  })

  const hasFilters = computed(() => {
    const current = query.value as unknown as Record<string, unknown>
    return keys.some((key) => key !== 'page' && current[key] !== undefined)
  })

  async function navigate(next: Record<string, string>, replace = false): Promise<void> {
    const preserved = Object.fromEntries(Object.entries(route.query).filter(([key]) => !(keys as readonly string[]).includes(key)))
    const target = { query: { ...preserved, ...next } }
    await (replace ? router.replace(target) : router.push(target))
  }

  function withValue(key: string, value: string | undefined, extra: Record<string, string> = {}): Record<string, string> {
    const next = { ...readUrl(), ...extra }
    const trimmed = value?.trim()
    if (trimmed) next[key] = trimmed
    else delete next[key]
    return next
  }

  // --- recherche temporisée ---
  const searchInput = ref(query.value.q ?? '')
  let timer: ReturnType<typeof setTimeout> | null = null

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  watch(searchInput, (value) => {
    clearTimer()
    if (value.trim() === (query.value.q ?? '')) return
    timer = setTimeout(() => {
      timer = null
      const next = withValue('q', value)
      delete next.page
      void navigate(next, true)
    }, ADMIN_SEARCH_DEBOUNCE_MS)
  })

  // Retour arrière / réinitialisation : l'URL redevient la source de vérité du champ.
  watch(
    () => query.value.q,
    (q) => {
      if (timer === null && (q ?? '') !== searchInput.value.trim()) searchInput.value = q ?? ''
    },
  )

  onScopeDispose(clearTimer)

  function setFilter(key: string, value: string | undefined): Promise<void> {
    clearTimer()
    const next = withValue(key, value)
    delete next.page
    return navigate(next)
  }

  function setPage(page: number): Promise<void> {
    const next = readUrl()
    if (page > 1) next.page = String(page)
    else delete next.page
    return navigate(next)
  }

  function reset(): Promise<void> {
    clearTimer()
    searchInput.value = ''
    return navigate({})
  }

  return { query, searchInput, hasFilters, setFilter, setPage, reset }
}
