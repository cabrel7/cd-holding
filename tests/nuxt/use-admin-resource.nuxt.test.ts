// Composable Nuxt (useFetch/$fetch) : nécessite l'environnement 'nuxt' (voir vitest.config.ts),
// d'où le suffixe `.nuxt.test.ts`. Un chemin de mock dédié par scénario évite toute
// interférence entre tests (registerEndpoint reste enregistré pour tout le fichier).
import { createError, defineEventHandler, readBody } from 'h3'
import { defineComponent } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'

interface TestItem {
  uuid: string
  nom: string
}

const VALID_UUID = '3fa85f64-5717-4562-a3fc-2c963f66afa6'

function mountResource(endpoint: `/api/admin/${string}`) {
  const TestHost = defineComponent({
    setup() {
      const { items, status, error, mutating, refresh, create, update, remove, reorder } = useAdminResource<
        TestItem,
        { nom: string }
      >({ endpoint })
      return { items, status, error, mutating, refresh, create, update, remove, reorder }
    },
    template: '<div />',
  })
  return mountSuspended(TestHost)
}

describe('useAdminResource', () => {
  it('charge la liste et expose le statut succès', async () => {
    registerEndpoint('/api/admin/contenu/test-success', {
      method: 'GET',
      handler: () => [{ uuid: VALID_UUID, nom: 'Partenaire A' }] satisfies TestItem[],
    })

    const wrapper = await mountResource('/api/admin/contenu/test-success')
    // `useFetch({ server: false })` déclenche le chargement après le montage (hors Suspense
    // initial) : on attend explicitement la fin du GET avant d'asserter le statut.
    await vi.waitFor(() => {
      if (wrapper.vm.status === 'pending') throw new Error('toujours en chargement')
    })

    expect(wrapper.vm.status).toBe('success')
    expect(wrapper.vm.items).toHaveLength(1)
    expect(wrapper.vm.items[0]?.nom).toBe('Partenaire A')
  })

  it('create() ajoute la fiche créée à la liste locale', async () => {
    registerEndpoint('/api/admin/contenu/test-create', {
      method: 'GET',
      handler: () => [] satisfies TestItem[],
    })
    registerEndpoint('/api/admin/contenu/test-create', {
      method: 'POST',
      handler: async (event) => {
        const body = await readBody<{ nom: string }>(event)
        return { uuid: VALID_UUID, nom: body.nom } satisfies TestItem
      },
    })

    const wrapper = await mountResource('/api/admin/contenu/test-create')
    const created = await wrapper.vm.create({ nom: 'Nouveau partenaire' })

    expect(created.nom).toBe('Nouveau partenaire')
    expect(wrapper.vm.items).toHaveLength(1)
  })

  it('normalise une erreur 4xx du serveur (message générique affichable)', async () => {
    registerEndpoint('/api/admin/contenu/test-4xx', {
      method: 'GET',
      handler: () => [] satisfies TestItem[],
    })
    registerEndpoint('/api/admin/contenu/test-4xx', {
      method: 'POST',
      handler: () => {
        throw createError({ statusCode: 409, statusMessage: 'Trois fiches maximum en avant' })
      },
    })

    const wrapper = await mountResource('/api/admin/contenu/test-4xx')

    await expect(wrapper.vm.create({ nom: 'x' })).rejects.toMatchObject({
      status: 409,
      message: 'Trois fiches maximum en avant',
    })
  })

  it('normalise une erreur 5xx en message générique (jamais de détail technique)', async () => {
    registerEndpoint('/api/admin/contenu/test-5xx', {
      method: 'GET',
      handler: () => [] satisfies TestItem[],
    })
    registerEndpoint('/api/admin/contenu/test-5xx', {
      method: 'POST',
      handler: () => {
        throw createError({ statusCode: 500, statusMessage: 'relation "x" does not exist' })
      },
    })

    const wrapper = await mountResource('/api/admin/contenu/test-5xx')

    await expect(wrapper.vm.create({ nom: 'x' })).rejects.toMatchObject({
      message: 'Une erreur est survenue. Réessayez.',
    })
  })

  it('rejette un uuid malformé avant toute requête réseau (update/remove/reorder)', async () => {
    let patchCalled = false
    registerEndpoint('/api/admin/contenu/test-uuid', {
      method: 'GET',
      handler: () => [] satisfies TestItem[],
    })
    registerEndpoint('/api/admin/contenu/test-uuid', {
      method: 'PATCH',
      handler: defineEventHandler(() => {
        patchCalled = true
        return { uuid: VALID_UUID, nom: 'x' } satisfies TestItem
      }),
    })

    const wrapper = await mountResource('/api/admin/contenu/test-uuid')

    await expect(wrapper.vm.update('pas-un-uuid', { nom: 'x' })).rejects.toMatchObject({ status: 400 })
    await expect(wrapper.vm.remove('pas-un-uuid')).rejects.toMatchObject({ status: 400 })
    await expect(wrapper.vm.reorder(['pas-un-uuid'])).rejects.toMatchObject({ status: 400 })
    expect(patchCalled).toBe(false)
  })
})
