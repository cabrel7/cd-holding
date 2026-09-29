// 401 admin : la session est vidée (sinon le middleware renvoie vers la cible → boucle), le cache
// `admin-*` est purgé, puis navigation vers la connexion avec `redirect`.
import { createError, defineEventHandler } from 'h3'
import { defineComponent, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'

const { clear, navigate } = vi.hoisted(() => ({
  clear: vi.fn(async () => undefined),
  navigate: vi.fn(async () => undefined),
}))

mockNuxtImport('useUserSession', () => () => ({
  clear,
  fetch: async () => undefined,
  session: ref(null),
  loggedIn: ref(true),
  user: ref({ uuid: 'u', nom: 'Test', role: 'SUPER_ADMIN', companyUuid: null }),
}))
mockNuxtImport('navigateTo', () => navigate)

registerEndpoint('/api/admin/test-unauthorized', {
  method: 'GET',
  handler: defineEventHandler(() => {
    throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  }),
})

describe('handleAdminUnauthorized', () => {
  beforeEach(() => {
    clear.mockClear()
    navigate.mockClear()
  })

  it('vide la session, purge le cache admin puis navigue vers la connexion', async () => {
    useState('admin-test-cache', () => 'donnee')
    await mountSuspended(defineComponent({ setup: () => () => null }), { route: '/admin/messages?page=2' })
    await handleAdminUnauthorized()

    expect(clear).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith({ path: ADMIN_LOGIN_PATH, query: { redirect: '/admin/messages?page=2' } })
    expect(clear.mock.invocationCallOrder[0]).toBeLessThan(navigate.mock.invocationCallOrder[0] ?? 0)
  }, 60_000)

  it('useAdminPagedList : un 401 déclenche le traitement (session vidée + navigation)', async () => {
    const Host = defineComponent({
      setup() {
        useAdminPagedList({ endpoint: '/api/admin/test-unauthorized', query: () => ({ page: 1 }) })
        return () => null
      },
    })
    await mountSuspended(Host, { route: '/admin/messages' })
    await vi.waitFor(() => expect(navigate).toHaveBeenCalled())
    expect(clear).toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith({ path: ADMIN_LOGIN_PATH, query: { redirect: '/admin/messages' } })
  })
})
