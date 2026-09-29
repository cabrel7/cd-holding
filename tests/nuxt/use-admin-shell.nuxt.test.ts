// useAdminShell : SUPER_ADMIN/ADMIN_FILIALE chargent sites + compteurs ; EMPLOYE n'émet aucun appel.
import { defineComponent, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'

const role = ref<'SUPER_ADMIN' | 'ADMIN_FILIALE' | 'EMPLOYE'>('SUPER_ADMIN')
const appels = { sites: 0, compteurs: 0 }

mockNuxtImport('useUserSession', () => () => ({
  user: ref({ uuid: 'u', nom: 'Test', role: role.value, companyUuid: null }),
}))

registerEndpoint('/api/admin/sites', () => {
  appels.sites += 1
  return [{ uuid: 's1', slug: 'entretien', nom: 'Entretien', modules: ['planning'] }]
})
registerEndpoint('/api/admin/messages/compteurs', () => {
  appels.compteurs += 1
  return { nouveaux: 3 }
})

function monter() {
  let shell!: ReturnType<typeof useAdminShell>
  const Hote = defineComponent({
    setup() {
      shell = useAdminShell()
      return () => null
    },
  })
  return mountSuspended(Hote).then(() => shell)
}

describe('useAdminShell', () => {
  beforeEach(() => {
    appels.sites = 0
    appels.compteurs = 0
    clearNuxtData(['admin-sites', 'admin-compteurs'])
  })

  it('SUPER_ADMIN : charge les sites et le compteur', async () => {
    role.value = 'SUPER_ADMIN'
    const shell = await monter()
    await vi.waitFor(() => {
      expect(shell.compteurs.value).toEqual({ nouveaux: 3 })
      expect(shell.sites.value).toHaveLength(1)
    })
  })

  it('EMPLOYE : aucun appel, valeurs vides', async () => {
    role.value = 'EMPLOYE'
    const shell = await monter()
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(appels).toEqual({ sites: 0, compteurs: 0 })
    expect(shell.sites.value).toEqual([])
    expect(shell.compteurs.value).toBeNull()
    await shell.refreshCompteurs()
    expect(appels.compteurs).toBe(0)
  })
})
