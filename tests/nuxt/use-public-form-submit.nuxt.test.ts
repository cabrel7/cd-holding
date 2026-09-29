// Composable Nuxt ($fetch) : nécessite l'environnement 'nuxt' (voir vitest.config.ts), d'où le
// suffixe `.nuxt.test.ts`. Chemin de mock dédié par scénario (motif use-admin-resource).
import { createError, setResponseHeader } from 'h3'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'

// Type alias (pas `interface`) : les types objets obtiennent une signature d'index implicite
// compatible avec la contrainte générique `Record<string, unknown>` de usePublicFormSubmit,
// contrairement à une interface (TS2344).
type TestBody = {
  formulaire: 'holding'
  nom: string
}

function mountSubmit(endpoint: `/api/public/${string}`) {
  const TestHost = defineComponent({
    setup() {
      const { envoyer, envoiEnCours, verrouille, soumettre } = usePublicFormSubmit<TestBody>(endpoint)
      // Handler à validation async (comme handleSubmit de vee-validate) : l'envoi n'a lieu qu'après.
      const appels = { valides: 0 }
      const onSubmit = soumettre(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
        appels.valides += 1
        await envoyer({ formulaire: 'holding', nom: 'Jean' })
      })
      return { envoyer, envoiEnCours, verrouille, onSubmit, appels }
    },
    template: '<div />',
  })
  return mountSuspended(TestHost)
}

describe('usePublicFormSubmit', () => {
  it('201 : renvoie ok:true', async () => {
    registerEndpoint('/api/public/contact-test-ok', {
      method: 'POST',
      handler: () => ({ ok: true }),
    })

    const wrapper = await mountSubmit('/api/public/contact-test-ok')
    const resultat = await wrapper.vm.envoyer({ formulaire: 'holding', nom: 'Jean' })

    expect(resultat).toEqual({ ok: true })
    expect(wrapper.vm.envoiEnCours).toBe(false)
  })

  it('400 : renvoie raison validation', async () => {
    registerEndpoint('/api/public/contact-test-400', {
      method: 'POST',
      handler: () => {
        throw createError({ statusCode: 400, statusMessage: 'Validation Error' })
      },
    })

    const wrapper = await mountSubmit('/api/public/contact-test-400')
    const resultat = await wrapper.vm.envoyer({ formulaire: 'holding', nom: '' })

    expect(resultat).toEqual({ ok: false, raison: 'validation', retryAfterSeconds: null })
  })

  it('429 : renvoie raison trop-de-requetes avec retryAfterSeconds lu depuis Retry-After', async () => {
    registerEndpoint('/api/public/contact-test-429', {
      method: 'POST',
      handler: (event) => {
        setResponseHeader(event, 'Retry-After', 42)
        throw createError({ statusCode: 429, statusMessage: 'Trop de tentatives, réessayez plus tard' })
      },
    })

    const wrapper = await mountSubmit('/api/public/contact-test-429')
    const resultat = await wrapper.vm.envoyer({ formulaire: 'holding', nom: 'Jean' })

    expect(resultat).toEqual({ ok: false, raison: 'trop-de-requetes', retryAfterSeconds: 42 })
  })

  it('500 : renvoie raison erreur (jamais de détail technique transmis)', async () => {
    registerEndpoint('/api/public/contact-test-500', {
      method: 'POST',
      handler: () => {
        throw createError({ statusCode: 500, statusMessage: 'relation "x" does not exist' })
      },
    })

    const wrapper = await mountSubmit('/api/public/contact-test-500')
    const resultat = await wrapper.vm.envoyer({ formulaire: 'holding', nom: 'Jean' })

    expect(resultat).toEqual({ ok: false, raison: 'erreur', retryAfterSeconds: null })
  })

  it('404 (offre retirée, endpoint absent) : renvoie raison introuvable sans jamais rejeter', async () => {
    const wrapper = await mountSubmit('/api/public/contact-test-introuvable')
    await expect(wrapper.vm.envoyer({ formulaire: 'holding', nom: 'Jean' })).resolves.toMatchObject({
      ok: false,
      raison: 'introuvable',
    })
  })

  it.each([413, 415])('%i : renvoie raison fichier', async (statusCode) => {
    registerEndpoint(`/api/public/contact-test-${statusCode}`, {
      method: 'POST',
      handler: () => {
        throw createError({ statusCode, statusMessage: 'Fichier refusé' })
      },
    })

    const wrapper = await mountSubmit(`/api/public/contact-test-${statusCode}`)
    await expect(wrapper.vm.envoyer({ formulaire: 'holding', nom: 'Jean' })).resolves.toMatchObject({
      ok: false,
      raison: 'fichier',
    })
  })

  it('bascule envoiEnCours pendant l’envoi', async () => {
    registerEndpoint('/api/public/contact-test-busy', {
      method: 'POST',
      handler: () => ({ ok: true }),
    })

    const wrapper = await mountSubmit('/api/public/contact-test-busy')
    const promesse = wrapper.vm.envoyer({ formulaire: 'holding', nom: 'Jean' })
    expect(wrapper.vm.envoiEnCours).toBe(true)
    await promesse
    expect(wrapper.vm.envoiEnCours).toBe(false)
  })

  it('soumettre : un double déclenchement rapide n’appelle l’endpoint qu’une fois', async () => {
    let appelsServeur = 0
    registerEndpoint('/api/public/contact-test-double', {
      method: 'POST',
      handler: () => {
        appelsServeur += 1
        return { ok: true }
      },
    })

    const wrapper = await mountSubmit('/api/public/contact-test-double')
    const premier = wrapper.vm.onSubmit()
    expect(wrapper.vm.verrouille).toBe(true)
    const second = wrapper.vm.onSubmit()
    await Promise.all([premier, second])

    expect(appelsServeur).toBe(1)
    expect(wrapper.vm.appels.valides).toBe(1)
    expect(wrapper.vm.verrouille).toBe(false)

    await wrapper.vm.onSubmit()
    expect(appelsServeur).toBe(2)
  })
})
