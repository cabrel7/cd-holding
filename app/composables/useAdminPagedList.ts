// Liste paginée admin (GET /api/admin/<ressource> → AdminPage<T>). Ne lance jamais de toast :
// l'erreur est exposée normalisée et affichée par AdminListState (avec « Réessayer »).
// Une session expirée (401) vide la session et renvoie vers la connexion (handleAdminUnauthorized).
import { computed, toValue, watch, type ComputedRef, type MaybeRefOrGetter } from 'vue'
import type { AdminError, AdminPage } from '#shared/types/admin'
import { toAdminError } from '@/utils/admin-error'
import { watchAdminUnauthorized } from '@/utils/admin-unauthorized'

export type AdminListState = 'loading' | 'error' | 'empty' | 'filtered-empty' | 'ready'

export interface UseAdminPagedListOptions<TQuery> {
  readonly endpoint: `/api/admin/${string}`
  readonly query: MaybeRefOrGetter<TQuery>
  /** Vrai si un filtre est actif : distingue « vide » de « vide filtré ». */
  readonly filtered?: MaybeRefOrGetter<boolean>
  /** Appelé quand la page demandée dépasse le total (ex. après suppression du dernier élément). */
  readonly onPageOutOfRange?: (lastPage: number) => void
}

export interface UseAdminPagedListReturn<TItem extends { uuid: string }, TPage = AdminPage<TItem>> {
  readonly items: ComputedRef<readonly TItem[]>
  readonly total: ComputedRef<number>
  readonly page: ComputedRef<number>
  readonly pageSize: ComputedRef<number>
  readonly pageCount: ComputedRef<number>
  readonly state: ComputedRef<AdminListState>
  readonly error: ComputedRef<AdminError | null>
  /** Page brute (null avant le premier chargement) — champs additionnels du DTO inclus. */
  readonly data: ComputedRef<TPage | null>
  /** Rechargement avec données déjà affichées (changement de page/filtre, refresh). */
  readonly refreshing: ComputedRef<boolean>
  refresh(): Promise<void>
}

export function useAdminPagedList<
  TItem extends { uuid: string },
  TQuery extends Record<string, string | number | undefined>,
  TPage extends AdminPage<TItem> = AdminPage<TItem>,
>(options: UseAdminPagedListOptions<TQuery>): UseAdminPagedListReturn<TItem, TPage> {
  const query = computed(() => toValue(options.query))

  const {
    data: fetchData,
    status,
    error: fetchError,
    refresh: refreshFetch,
  } = useFetch<AdminPage<TItem> | null>(options.endpoint, {
    query,
    server: false,
    key: `admin-list:${options.endpoint}`,
    default: () => null,
  })

  // `useFetch` infère un type de ref trop large : on re-typpe la page. L'assignation est sûre —
  // l'appelant instancie `TPage` avec un sous-ensemble des champs d'`AdminPage<TItem>`.
  const data = computed(() => fetchData.value) as ComputedRef<TPage | null>

  const error = computed<AdminError | null>(() => (fetchError.value ? toAdminError(fetchError.value) : null))
  const items = computed<readonly TItem[]>(() => data.value?.items ?? [])
  const total = computed(() => data.value?.total ?? 0)
  const page = computed(() => data.value?.page ?? 1)
  const pageSize = computed(() => data.value?.pageSize ?? 0)
  const pageCount = computed(() => data.value?.pageCount ?? 0)
  const refreshing = computed(() => status.value === 'pending' && data.value !== null)

  const outOfRange = computed(() => data.value !== null && data.value.items.length === 0 && data.value.total > 0)

  const state = computed<AdminListState>(() => {
    if (error.value) return 'error'
    if (data.value === null || outOfRange.value) return 'loading'
    if (data.value.total === 0) return toValue(options.filtered) ? 'filtered-empty' : 'empty'
    return 'ready'
  })

  watch(outOfRange, (isOut) => {
    if (isOut) options.onPageOutOfRange?.(Math.max(1, pageCount.value))
  })

  watchAdminUnauthorized(fetchError)

  async function refresh(): Promise<void> {
    await refreshFetch()
  }

  return { items, total, page, pageSize, pageCount, state, error, data, refreshing, refresh }
}

