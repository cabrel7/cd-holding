// Filtres ↔ URL : validation zod avec repli sur les défauts, page remise à 1, recherche temporisée.
import { defineComponent } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { messagesQuerySchema, type MessagesQuery } from '#shared/validation/admin'

function mountQuery(url: string) {
  const Host = defineComponent({
    setup() {
      const q = useAdminListQuery<MessagesQuery>(messagesQuerySchema, ['site', 'type', 'statut', 'q', 'page'])
      return { ...q, route: useRoute() }
    },
    template: '<div />',
  })
  return mountSuspended(Host, { route: url })
}

describe('useAdminListQuery', () => {
  it('lit les filtres valides depuis l’URL', async () => {
    const w = await mountQuery('/?statut=NOUVEAU&page=2&q=abc')
    expect(w.vm.query.statut).toBe('NOUVEAU')
    expect(w.vm.query.page).toBe(2)
    expect(w.vm.query.q).toBe('abc')
    expect(w.vm.hasFilters).toBe(true)
  })

  it('retombe sur les défauts si une valeur est invalide', async () => {
    const w = await mountQuery('/?statut=BIDON&page=-4')
    expect(w.vm.query.statut).toBeUndefined()
    expect(w.vm.query.page).toBe(1)
    expect(w.vm.hasFilters).toBe(false)
  })

  it('setFilter remet la page à 1 et écrit dans l’URL', async () => {
    const w = await mountQuery('/?page=3')
    await w.vm.setFilter('statut', 'TRAITE')
    expect(w.vm.route.query.statut).toBe('TRAITE')
    expect(w.vm.route.query.page).toBeUndefined()
  })

  it('temporise la recherche (300 ms) puis met à jour l’URL', async () => {
    const w = await mountQuery('/?page=2')
    w.vm.searchInput = 'dupont'
    expect(w.vm.route.query.q).toBeUndefined()
    await vi.waitFor(() => {
      if (w.vm.route.query.q !== 'dupont') throw new Error('URL non mise à jour')
    })
    expect(w.vm.route.query.page).toBeUndefined()
  })

  it('reset vide les filtres', async () => {
    const w = await mountQuery('/?statut=NOUVEAU&q=x')
    await w.vm.reset()
    expect(w.vm.route.query.statut).toBeUndefined()
    expect(w.vm.searchInput).toBe('')
  })
})
