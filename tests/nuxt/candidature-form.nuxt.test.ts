// Composant Nuxt (FormField/vee-validate, useFetch, NuxtLink) : nécessite l'environnement
// 'nuxt' (voir vitest.config.ts), d'où le suffixe `.nuxt.test.ts`. `/api/public/sites/holding`
// est nécessaire à chaque test : CandidatureForm rend toujours un titre via <TexteAccentue>, qui
// appelle `useSiteTextVars` → `useSite` (peu importe le contenu, seul son absence de crash compte
// ici — la valeur du site n'est pas ce qui est testé).
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { CANDIDATURE_LIMITS } from '#shared/config/candidature'
import type { PublicOffreDto } from '#shared/types/public'
import CandidatureForm from '@/components/site/placement/CandidatureForm.vue'

const OFFRE: PublicOffreDto = {
  uuid: '3fa85f64-5717-4562-a3fc-2c963f66afa6',
  titre: 'Manutentionnaire — quart de jour',
  lieu: 'Lachine, Montréal',
  typeContrat: 'TEMPS_PLEIN',
  salaire: '22 $/h',
  description: 'Chargement et déchargement en entrepôt.',
  publieeLe: '2026-01-01T00:00:00.000Z',
}

function fichier(nom: string, type: string, octets = 10): File {
  return new File([new Uint8Array(octets)], nom, { type })
}

function selectionnerFichier(input: Element, fichiers: File[]): void {
  Object.defineProperty(input, 'files', { value: fichiers, configurable: true })
  input.dispatchEvent(new Event('change'))
}

async function remplirChampsRequis(wrapper: VueWrapper) {
  await wrapper.find('input[name="nom"]').setValue('Jean Tremblay')
  await wrapper.find('input[name="email"]').setValue('jean@exemple.ca')
  await wrapper.find('input[name="telephone"]').setValue('514-000-0000')
  await wrapper.find('input[name="pays"]').setValue('Canada')
  await wrapper.find('input[name="adresseComplete"]').setValue('1234 rue Exemple, Montréal (Québec) H1H 1H1')
  await wrapper.find('select[name="experience"]').setValue('UN_A_TROIS_ANS')
  selectionnerFichier(wrapper.find('input[type="file"]:not([multiple])').element, [fichier('cv.pdf', 'application/pdf')])
  await wrapper.find('input[type="checkbox"]').setValue(true)
  await flushPromises()
}

// Le mock d'endpoint de @nuxt/test-utils ne transmet pas le Content-Type multipart : on observe
// donc le FormData construit par le composant (get/has/getAll sur l'instance envoyée) et on
// enregistre l'appel réseau via un endpoint qui renvoie simplement ok.
interface Envoi {
  appele: boolean
  formData: FormData | null
}

function espionnerEnvoi(): Envoi {
  const envoi: Envoi = { appele: false, formData: null }
  const original = globalThis.FormData
  vi.spyOn(globalThis, 'FormData').mockImplementation(function (this: FormData, ...args: unknown[]) {
    const instance = new (original as unknown as new (...a: unknown[]) => FormData)(...args)
    envoi.formData = instance
    return instance
  } as never)
  registerEndpoint('/api/public/placement/candidatures', {
    method: 'POST',
    handler: () => {
      envoi.appele = true
      return { ok: true }
    },
  })
  return envoi
}

describe('CandidatureForm', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    registerEndpoint('/api/public/sites/holding', { method: 'GET', handler: () => null })
  })

  it('avec une offre : pas de champ poste, le FormData contient demandeUuid et le CV', async () => {
    const envoi = espionnerEnvoi()

    const wrapper = await mountSuspended(CandidatureForm, {
      props: { offre: OFFRE, section: undefined, vars: {}, mention: null, emailSecours: null },
    })

    expect(wrapper.find('select[name="posteRecherche"]').exists()).toBe(false)

    await remplirChampsRequis(wrapper)
    await wrapper.find('form').trigger('submit')
    await vi.waitFor(() => expect(envoi.appele).toBe(true), { timeout: 3000 })
    const formData = envoi.formData as FormData
    expect(formData.get('demandeUuid')).toBe(OFFRE.uuid)
    expect(formData.get('consentement')).toBe('true')
    expect(formData.has('posteRecherche')).toBe(false)
    expect((formData.get('cv') as File).name).toBe('cv.pdf')
  })

  it('sans offre, poste « Autre » : la précision est exigée et transmise, sans demandeUuid', async () => {
    const envoi = espionnerEnvoi()

    const wrapper = await mountSuspended(CandidatureForm, {
      props: { offre: null, section: undefined, vars: {}, mention: null, emailSecours: null },
    })

    const posteSelect = wrapper.find('select[name="posteRecherche"]')
    expect(posteSelect.exists()).toBe(true)
    await posteSelect.setValue('autre')

    expect(wrapper.find('input[name="posteAutrePrecision"]').exists()).toBe(true)
    await wrapper.find('input[name="posteAutrePrecision"]').setValue('Réceptionniste')

    await remplirChampsRequis(wrapper)
    await wrapper.find('form').trigger('submit')
    await vi.waitFor(() => expect(envoi.appele).toBe(true), { timeout: 3000 })
    const formData = envoi.formData as FormData
    expect(formData.has('demandeUuid')).toBe(false)
    expect(formData.get('posteRecherche')).toBe('autre')
    expect(formData.get('posteAutrePrecision')).toBe('Réceptionniste')
  })

  it('consentement manquant : aucun envoi réseau, focus sur le premier champ invalide', async () => {
    let appele = false
    registerEndpoint('/api/public/placement/candidatures', {
      method: 'POST',
      handler: () => {
        appele = true
        return { ok: true }
      },
    })

    const wrapper = await mountSuspended(CandidatureForm, {
      props: { offre: OFFRE, section: undefined, vars: {}, mention: null, emailSecours: null },
      attachTo: document.body,
    })

    // Tous les champs requis sauf le consentement.
    await wrapper.find('input[name="nom"]').setValue('Jean Tremblay')
    await wrapper.find('input[name="email"]').setValue('jean@exemple.ca')
    await wrapper.find('input[name="telephone"]').setValue('514-000-0000')
    await wrapper.find('input[name="pays"]').setValue('Canada')
    await wrapper.find('input[name="adresseComplete"]').setValue('1234 rue Exemple, Montréal (Québec) H1H 1H1')
    await wrapper.find('select[name="experience"]').setValue('UN_A_TROIS_ANS')
    selectionnerFichier(wrapper.find('input[type="file"]:not([multiple])').element, [fichier('cv.pdf', 'application/pdf')])
    await flushPromises()

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(appele).toBe(false)
    expect(document.activeElement?.getAttribute('aria-invalid')).toBe('true')

    wrapper.unmount()
  })

  it('ChampFichier (CV) : la sélection affiche le nom, « Retirer » le supprime', async () => {
    const wrapper = await mountSuspended(CandidatureForm, {
      props: { offre: OFFRE, section: undefined, vars: {}, mention: null, emailSecours: null },
    })

    const cvInput = wrapper.find('input[type="file"]:not([multiple])')
    selectionnerFichier(cvInput.element, [fichier('mon-cv.pdf', 'application/pdf')])
    await flushPromises()

    expect(wrapper.text()).toContain('mon-cv.pdf')

    await wrapper.find('button[aria-label="Retirer mon-cv.pdf"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).not.toContain('mon-cv.pdf')
  })

  it(`ChampFichier (documents) : plafonné à ${CANDIDATURE_LIMITS.documentsMax} fichiers sur plusieurs sélections`, async () => {
    const wrapper = await mountSuspended(CandidatureForm, {
      props: { offre: OFFRE, section: undefined, vars: {}, mention: null, emailSecours: null },
    })

    const documentsInput = wrapper.find('input[type="file"][multiple]')
    selectionnerFichier(
      documentsInput.element,
      [1, 2, 3].map((n) => fichier(`doc-${n}.pdf`, 'application/pdf')),
    )
    await flushPromises()
    selectionnerFichier(
      documentsInput.element,
      [4, 5, 6].map((n) => fichier(`doc-${n}.pdf`, 'application/pdf')),
    )
    await flushPromises()

    expect(wrapper.findAll('li').length).toBe(CANDIDATURE_LIMITS.documentsMax)
    expect(wrapper.text()).not.toContain('doc-6.pdf')
  })
})
