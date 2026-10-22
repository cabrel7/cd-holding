// Composant Vue (VeeValidate + $fetch) : nécessite l'environnement 'nuxt' (voir vitest.config.ts).
// Questionnaire SCRIPTÉ (DEC-14) : ces tests vérifient notamment qu'aucun libellé « IA » n'apparaît
// et que la recommandation vient de la section éditable (SERVICES:assistant), jamais générée.
import { readBody } from 'h3'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { toast } from 'vue-sonner'
import AssistantImportExport, { type AssistantSectionData } from '@/components/site/services/AssistantImportExport.vue'

const SECTION: AssistantSectionData = {
  surtitre: 'Assistant import-export',
  titre: 'Cinq questions pour bâtir votre plan d’approvisionnement.',
  recommandations: {
    petit: 'Commande test depuis notre stock de Montréal, livrée sous 72 heures.',
    moyen: 'Groupage palettisé mensuel, arrivage regroupé avec nos autres clients.',
    grand: 'Conteneur dédié 20 pieds au départ de Douala ou Dakar.',
  },
  mentionDelai: 'Votre demande a été transmise à l’équipe import-export : nous revenons vers vous sous 48 heures ouvrables.',
}

function mount() {
  return mountSuspended(AssistantImportExport, {
    props: { section: SECTION, vars: {}, mention: null, emailSecours: null },
  })
}

function boutonContenant(wrapper: Awaited<ReturnType<typeof mount>>, texte: string) {
  const bouton = wrapper.findAll('button').find((b) => b.text().includes(texte))
  if (!bouton) throw new Error(`Bouton « ${texte} » introuvable`)
  return bouton
}

async function repondre(wrapper: Awaited<ReturnType<typeof mount>>, valeur: string) {
  await wrapper.find(`input[type="radio"][value="${valeur}"]`).setValue()
}

describe('AssistantImportExport', () => {
  it('« Continuer » est désactivé tant qu’aucune réponse n’est choisie, activé après sélection', async () => {
    const wrapper = await mount()
    const continuer = boutonContenant(wrapper, 'Continuer')
    expect(continuer.attributes('disabled')).toBeDefined()

    await repondre(wrapper, 'epicerie')
    expect(boutonContenant(wrapper, 'Continuer').attributes('disabled')).toBeUndefined()
  })

  it('annonce l’étape courante (aria-live) et avance/recule entre les étapes au clavier (radios natifs)', async () => {
    const wrapper = await mount()
    expect(wrapper.find('[aria-live="polite"]').text()).toContain('Étape 1 sur 5')

    await repondre(wrapper, 'epicerie')
    await boutonContenant(wrapper, 'Continuer').trigger('click')
    await nextTick()

    expect(wrapper.find('[aria-live="polite"]').text()).toContain('Étape 2 sur 5')
    expect(boutonContenant(wrapper, 'Retour')).toBeTruthy()

    await boutonContenant(wrapper, 'Retour').trigger('click')
    await nextTick()
    expect(wrapper.find('[aria-live="polite"]').text()).toContain('Étape 1 sur 5')
  })

  it('à l’étape 5, un envoi réussi affiche la recommandation de la section et poste formulaire=assistant', async () => {
    let corpsRecu: Record<string, unknown> = {}
    registerEndpoint('/api/public/contact', {
      method: 'POST',
      handler: async (event) => {
        corpsRecu = await readBody(event)
        return { ok: true }
      },
    })
    const succesSpy = vi.spyOn(toast, 'success').mockImplementation(() => '')

    const wrapper = await mount()

    await repondre(wrapper, 'restaurant')
    await boutonContenant(wrapper, 'Continuer').trigger('click')
    await nextTick()
    await repondre(wrapper, 'fruits-legumes')
    await boutonContenant(wrapper, 'Continuer').trigger('click')
    await nextTick()
    await repondre(wrapper, '1-5t')
    await boutonContenant(wrapper, 'Continuer').trigger('click')
    await nextTick()
    await repondre(wrapper, 'immediat')
    await boutonContenant(wrapper, 'Continuer').trigger('click')
    await nextTick()

    expect(wrapper.find('[aria-live="polite"]').text()).toContain('Étape 5 sur 5')

    await wrapper.find('input[name="nom"]').setValue('Jean Tremblay')
    await wrapper.find('input[name="email"]').setValue('jean@exemple.ca')
    await wrapper.find('form').trigger('submit')
    await vi.waitFor(() => expect(corpsRecu).not.toEqual({}))
    await flushPromises()

    expect(corpsRecu).toMatchObject({
      formulaire: 'assistant',
      nom: 'Jean Tremblay',
      email: 'jean@exemple.ca',
      reponses: { profil: 'restaurant', categorie: 'fruits-legumes', volume: '1-5t', delai: 'immediat' },
    })
    expect(succesSpy).toHaveBeenCalled()
    succesSpy.mockRestore()

    // Volume '1-5t' → palier 'grand' (shared/content/cdpaa/assistant-import-export.ts)
    expect(wrapper.text()).toContain(SECTION.recommandations.grand)
    expect(wrapper.text()).toContain(SECTION.mentionDelai)
  })

  it('ne se présente jamais comme une intelligence artificielle (DEC-14, questionnaire scripté)', async () => {
    const wrapper = await mount()
    expect(wrapper.text()).not.toMatch(/\bIA\b/)
    expect(wrapper.text().toLowerCase()).not.toContain('intelligence artificielle')
  })
})
