// Composable Nuxt (useFetch) : environnement 'nuxt' requis. Un chemin de mock dédié par scénario.
import { createError, defineEventHandler, getQuery } from 'h3'
import { defineComponent, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { AdminPage } from '#shared/types/admin'

interface Item {
  uuid: string
  nom: string
}

const U1 = '3fa85f64-5717-4562-a3fc-2c963f66afa6'

function page(items: Item[], total: number, pageNumber = 1): AdminPage<Item> {
  return { items, total, page: pageNumber, pageSize: 20, pageCount: Math.max(1, Math.ceil(total / 20)) }
}

function mountList(
  endpoint: `/api/admin/${string}`,
  opts: { filtered?: boolean; onOut?: (p: number) => void; pageRef?: ReturnType<typeof ref<number>> } = {},
) {
  const pageRef = opts.pageRef ?? ref(1)
  const Host = defineComponent({
    setup() {
      const list = useAdminPagedList<Item, { page: number }>({
        endpoint,
        query: () => ({ page: pageRef.value ?? 1 }),
        filtered: opts.filtered ?? false,
        onPageOutOfRange: opts.onOut,
      })
      return { ...list }
    },
    template: '<div />',
  })
  return mountSuspended(Host)
}

async function settled(wrapper: Awaited<ReturnType<typeof mountList>>) {
  await vi.waitFor(() => {
    if (wrapper.vm.state === 'loading') throw new Error('toujours en chargement')
  })
}

describe('useAdminPagedList', () => {
  it('expose les éléments et la pagination (état ready)', async () => {
    registerEndpoint('/api/admin/test-list-ready', () => page([{ uuid: U1, nom: 'A' }], 21))
    const wrapper = await mountList('/api/admin/test-list-ready')
    await settled(wrapper)

    expect(wrapper.vm.state).toBe('ready')
    expect(wrapper.vm.items).toHaveLength(1)
    expect(wrapper.vm.total).toBe(21)
    expect(wrapper.vm.pageCount).toBe(2)
  })

  it('distingue vide et vide filtré', async () => {
    registerEndpoint('/api/admin/test-list-empty', () => page([], 0))
    const vide = await mountList('/api/admin/test-list-empty')
    await settled(vide)
    expect(vide.vm.state).toBe('empty')

    const filtre = await mountList('/api/admin/test-list-empty', { filtered: true })
    await settled(filtre)
    expect(filtre.vm.state).toBe('filtered-empty')
  })

  it('normalise l’erreur serveur (état error, message affichable)', async () => {
    registerEndpoint('/api/admin/test-list-error', {
      method: 'GET',
      handler: defineEventHandler(() => {
        throw createError({ statusCode: 403, statusMessage: 'Acces refuse' })
      }),
    })
    const wrapper = await mountList('/api/admin/test-list-error')
    await vi.waitFor(() => {
      if (wrapper.vm.state !== 'error') throw new Error('pas encore en erreur')
    })
    expect(wrapper.vm.error?.message).toBe('Acces refuse')
    expect(wrapper.vm.error?.status).toBe(403)
  })

  it('recharge quand la requête change', async () => {
    registerEndpoint(
      '/api/admin/test-list-page',
      defineEventHandler((event) => {
        const p = Number(getQuery(event).page)
        return page([{ uuid: U1, nom: `page-${p}` }], 40, p)
      }),
    )
    const pageRef = ref(1)
    const wrapper = await mountList('/api/admin/test-list-page', { pageRef })
    await settled(wrapper)
    expect(wrapper.vm.items[0]?.nom).toBe('page-1')

    pageRef.value = 2
    await vi.waitFor(() => {
      if (wrapper.vm.items[0]?.nom !== 'page-2') throw new Error('page 2 non chargée')
    })
    expect(wrapper.vm.page).toBe(2)
  })

  it('signale une page hors bornes avec la dernière page', async () => {
    registerEndpoint('/api/admin/test-list-out', () => ({ items: [], total: 45, page: 9, pageSize: 20, pageCount: 3 }))
    const onOut = vi.fn()
    const wrapper = await mountList('/api/admin/test-list-out', { onOut })
    await vi.waitFor(() => {
      if (onOut.mock.calls.length === 0) throw new Error('callback non appelé')
    })
    expect(onOut).toHaveBeenCalledWith(3)
    expect(wrapper.vm.state).toBe('loading')
  })
})
