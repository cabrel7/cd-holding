// Composable générique CRUD + réordonnancement pour le CMS admin (spec phase 2 §4.6).
// Ne lance jamais de toast (reste testable, voir tests/nuxt/use-admin-resource.nuxt.test.ts) —
// les composants (CmsCollectionEditor, CmsSectionsEditor) traduisent `error`/les rejets en toast.
// Seule exception côté effet : un 401 (session expirée) redirige vers la connexion via
// `watchAdminUnauthorized`, sinon l'éditeur resterait affiché avec un cache admin périmé.
import { z } from 'zod'
import { computed, ref, toValue, type MaybeRefOrGetter, type Ref } from 'vue'
import type { SiteSlug } from '#shared/config/sites'
import type { AdminError } from '#shared/types/admin'
import { toAdminError } from '@/utils/admin-error'
import { watchAdminUnauthorized } from '@/utils/admin-unauthorized'

export interface UseAdminResourceOptions {
  readonly endpoint: `/api/admin/${string}`
  readonly site?: MaybeRefOrGetter<SiteSlug | undefined>
}

export type AdminResourceStatus = 'idle' | 'pending' | 'success' | 'error'

export interface UseAdminResourceReturn<TItem extends { uuid: string }, TCreate, TUpdate> {
  readonly items: Readonly<Ref<readonly TItem[]>>
  readonly status: Readonly<Ref<AdminResourceStatus>>
  readonly error: Readonly<Ref<AdminError | null>>
  readonly mutating: Readonly<Ref<boolean>>
  refresh(): Promise<void>
  create(payload: TCreate): Promise<TItem>
  update(uuid: string, payload: TUpdate): Promise<TItem>
  remove(uuid: string): Promise<void>
  reorder(uuids: readonly string[]): Promise<void>
}

// `$fetch` typé par Nitro tente de faire correspondre l'URL à une route connue littérale ;
// ce composable est générique (l'URL vient d'une config au runtime, jamais un littéral), ce
// qui produit une récursion de type excessive (TS2321) si on laisse `$fetch` l'inférer. On
// retombe sur un typage explicite via le générique `<T>` de chaque appel, la seule information
// dont on a besoin ici (le corps/la méthode sont déjà validés par les schémas zod partagés).
type JsonFetch = <T>(url: string, opts: { method: string; body?: unknown; query?: unknown }) => Promise<T>
const jsonFetch = $fetch as unknown as JsonFetch

const uuidSchema = z.string().uuid()

/** uuid malformé → erreur 400 normalisée, avant toute requête réseau. */
function assertValidUuid(value: string): string {
  const result = uuidSchema.safeParse(value)
  if (!result.success) {
    throw Object.assign(new Error('Identifiant invalide'), {
      statusCode: 400,
      statusMessage: 'Identifiant invalide',
    })
  }
  return result.data
}

export function useAdminResource<TItem extends { uuid: string }, TCreate, TUpdate = Partial<TCreate>>(
  options: UseAdminResourceOptions,
): UseAdminResourceReturn<TItem, TCreate, TUpdate> {
  const siteValue = computed(() => toValue(options.site))
  const query = computed(() => (siteValue.value ? { site: siteValue.value } : {}))

  const {
    data,
    status: fetchStatus,
    error: fetchError,
    refresh: refreshFetch,
  } = useFetch<TItem[]>(options.endpoint, {
    query,
    server: false,
    watch: [siteValue],
    key: `admin-resource:${options.endpoint}`,
    default: () => [] as TItem[],
  })

  const mutating = ref(false)
  const mutationError = ref<AdminError | null>(null)

  // Session expirée sur le chargement de la liste OU pendant une mutation (create/update/
  // remove/reorder) : redirection unique vers la connexion, idempotente sous 401 simultanés.
  watchAdminUnauthorized(fetchError)
  watchAdminUnauthorized(mutationError)

  const items = computed<readonly TItem[]>(() => data.value ?? [])
  const status = computed<AdminResourceStatus>(() => fetchStatus.value)
  const error = computed<AdminError | null>(() => (fetchError.value ? toAdminError(fetchError.value) : mutationError.value))

  async function refresh(): Promise<void> {
    await refreshFetch()
  }

  async function withMutation<T>(run: () => Promise<T>): Promise<T> {
    mutating.value = true
    mutationError.value = null
    try {
      return await run()
    } catch (e) {
      const adminError = toAdminError(e)
      mutationError.value = adminError
      throw adminError
    } finally {
      mutating.value = false
    }
  }

  function create(payload: TCreate): Promise<TItem> {
    return withMutation(async () => {
      const created = await jsonFetch<TItem>(options.endpoint, { method: 'POST', body: payload })
      data.value = [...(data.value ?? []), created]
      return created
    })
  }

  function update(uuid: string, payload: TUpdate): Promise<TItem> {
    return withMutation(async () => {
      const validUuid = assertValidUuid(uuid)
      const updated = await jsonFetch<TItem>(`${options.endpoint}/${encodeURIComponent(validUuid)}`, {
        method: 'PATCH',
        body: payload,
      })
      data.value = (data.value ?? []).map((item) => (item.uuid === uuid ? updated : item))
      return updated
    })
  }

  function remove(uuid: string): Promise<void> {
    return withMutation(async () => {
      const validUuid = assertValidUuid(uuid)
      await jsonFetch(`${options.endpoint}/${encodeURIComponent(validUuid)}`, { method: 'DELETE' })
      data.value = (data.value ?? []).filter((item) => item.uuid !== uuid)
    })
  }

  function reorder(uuids: readonly string[]): Promise<void> {
    return withMutation(async () => {
      const validUuids = uuids.map(assertValidUuid)
      const site = siteValue.value
      await jsonFetch(`${options.endpoint}/ordre`, {
        method: 'PATCH',
        body: site ? { site, uuids: validUuids } : { uuids: validUuids },
      })
      await refreshFetch()
    })
  }

  return {
    items: items as Readonly<Ref<readonly TItem[]>>,
    status,
    error,
    mutating,
    refresh,
    create,
    update,
    remove,
    reorder,
  }
}
