<script setup lang="ts">
// Assistant import-export (ccdpaa) — spec lot3 §3/§4, questionnaire SCRIPTÉ (DEC-14) : aucune
// IA, aucun appel LLM, jamais présenté comme tel. Affiché par la page appelante seulement si la
// section éditable `SERVICES:assistant` existe (aucun `if (slug)` ici). Carte sombre (fidélité
// prototype) rendue accessible : champs/mention via <ChampContact>/<MentionConfidentialite>
// `tone="sombre"`, jamais de texte blanc sur `bg-site-accent` (contraste), anneau de focus blanc
// avec espacement navy (`--carte-fond`) sur tous les contrôles.
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { ArrowLeft, ArrowRight, Check, RotateCcw, Send } from '@lucide/vue'
import {
  ASSISTANT_FORM,
  ETAPES_ASSISTANT,
  ETAPE_CONTACT,
  NOMBRE_ETAPES,
  palierRecommandation,
  recapReponses,
  type PalierRecommandation,
  type ReponsesAssistant,
} from '#shared/content/ccdpaa/assistant-import-export'
import { assistantFormSchema, type AssistantFormValues } from '#shared/validation/contact'
import type { TexteVars } from '#shared/utils/texte'
import { usePublicFormSubmit } from '@/composables/usePublicFormSubmit'
import { usePublicFormFeedback } from '@/composables/usePublicFormFeedback'
import type { ChampContact as ChampContactConfig } from '#shared/config/contact-forms'
import { FOCUS_CARTE_SOMBRE } from '@/utils/formClasses'
import { FormField } from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import ChampContact from '@/components/site/contact/ChampContact.vue'
import MentionConfidentialite from '@/components/site/form/MentionConfidentialite.vue'
import HoneypotField from '@/components/site/form/HoneypotField.vue'
import TexteAccentue from '@/components/site/TexteAccentue.vue'

/** Type catalogue `assistant` (SERVICES:assistant), miroir de `assistantSchema`
 * (shared/content/sections/types.ts). Exporté : consommé par [filiale]/services.vue. */
export interface AssistantSectionData {
  readonly surtitre: string
  readonly titre: string
  readonly recommandations: { readonly petit: string; readonly moyen: string; readonly grand: string }
  readonly mentionDelai: string
}

const CHAMP_NOM: ChampContactConfig = { type: 'nom', label: 'Nom', placeholder: 'Jean Tremblay' }
const CHAMP_ENTREPRISE: ChampContactConfig = { type: 'entreprise', label: 'Entreprise (facultatif)' }
const CHAMP_EMAIL: ChampContactConfig = { type: 'email', label: 'Courriel', placeholder: 'vous@exemple.ca' }
const CHAMP_TELEPHONE: ChampContactConfig = { type: 'telephone', label: 'Téléphone (facultatif)', placeholder: '514-000-0000' }

const CONTROLE_BASE = `inline-flex min-h-12 items-center gap-2 rounded-full border border-white/25 px-5 text-sm font-medium hover:bg-white/10 ${FOCUS_CARTE_SOMBRE}`
const BOUTON_PRIMAIRE = `group inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-navy transition-colors hover:bg-cream disabled:pointer-events-none disabled:opacity-50 ${FOCUS_CARTE_SOMBRE}`

const props = defineProps<{
  section: AssistantSectionData
  vars: TexteVars
  mention: string | null
  emailSecours: string | null
}>()

type AssistantBody = AssistantFormValues & { formulaire: 'assistant'; reponses: ReponsesAssistant }

// Collecte des réponses aux 4 questions (étapes 0-3) — typage relâché pendant la saisie (les
// options viennent de la config au runtime), resserré en `ReponsesAssistant` seulement à l'envoi
// (garanti complet : chaque étape bloque « Continuer » tant qu'aucune option n'est choisie).
const reponses = reactive<Record<string, string>>({})
const etapeIndex = ref(0)
const termine = ref(false)
const palier = ref<PalierRecommandation | null>(null)
const recapFinal = ref<ReturnType<typeof recapReponses> | null>(null)

const estEtapeContact = computed(() => etapeIndex.value === ETAPES_ASSISTANT.length)
const etapeCourante = computed(() => (estEtapeContact.value ? null : ETAPES_ASSISTANT[etapeIndex.value]))
const valeurCourante = computed(() => (etapeCourante.value ? reponses[etapeCourante.value.cle] : undefined))

function setValeur(valeur: string) {
  if (etapeCourante.value) reponses[etapeCourante.value.cle] = valeur
}
function continuer() {
  if (!valeurCourante.value) return
  etapeIndex.value += 1
}
function retour() {
  if (etapeIndex.value > 0) etapeIndex.value -= 1
}

const recommandationTexte = computed(() => (palier.value ? props.section.recommandations[palier.value] : ''))

// Focus la question (ou le résultat) à chaque changement d'étape — accessibilité clavier (spec §4).
// Étapes : `@after-enter` de la <Transition> (l'élément entrant est monté) ; récapitulatif et
// « Recommencer » : hors transition, donc focus direct après le rendu.
const panelHeadingRef = ref<HTMLElement | null>(null)
const sectionRef = ref<HTMLElement | null>(null)
function focuserEtape(el: Element): void {
  el.querySelector<HTMLElement>('legend')?.focus()
}
async function focuserApresRendu(cible: () => HTMLElement | null | undefined): Promise<void> {
  await nextTick()
  cible()?.focus()
}

const schemaContact = toTypedSchema(assistantFormSchema)
const { handleSubmit, resetForm } = useForm<AssistantFormValues>({
  validationSchema: schemaContact,
  initialValues: { nom: '', email: '', entreprise: '', telephone: '', website: '' },
})

const { envoyer, envoiEnCours, verrouille, soumettre } = usePublicFormSubmit<AssistantBody>('/api/public/contact')
const { notifierResultat } = usePublicFormFeedback()

const contactFormRef = ref<HTMLFormElement | null>(null)

const onSubmitContact = soumettre(handleSubmit(
  async (contactValues) => {
    // Seul cast du fichier : `reponses` est garanti complet à ce stade (chaque étape bloque
    // « Continuer » sans réponse), couvert par tests/nuxt/assistant.nuxt.test.ts.
    const reponsesCompletes = reponses as unknown as ReponsesAssistant
    const resultat = await envoyer({ formulaire: 'assistant', reponses: reponsesCompletes, ...contactValues })
    const succes = notifierResultat(resultat, {
      titreSucces: ASSISTANT_FORM.toastTitre,
      messageSucces: 'Découvrez votre recommandation ci-dessous.',
      vars: props.vars,
      emailSecours: props.emailSecours,
    })
    if (succes) {
      palier.value = palierRecommandation(reponsesCompletes.volume)
      recapFinal.value = recapReponses(reponsesCompletes)
      termine.value = true
      await focuserApresRendu(() => panelHeadingRef.value)
    }
  },
  async () => {
    await nextTick()
    contactFormRef.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  },
))

function recommencer() {
  for (const cle of Object.keys(reponses)) delete reponses[cle]
  etapeIndex.value = 0
  termine.value = false
  palier.value = null
  recapFinal.value = null
  resetForm()
  void focuserApresRendu(() => sectionRef.value?.querySelector<HTMLElement>('legend'))
}
</script>

<template>
  <section ref="sectionRef" class="pb-24 md:pb-32">
    <div class="mx-auto max-w-7xl px-6">
      <div class="overflow-hidden rounded-[1.75rem] bg-navy p-8 text-white [--carte-fond:var(--navy)] md:p-12">
        <TexteAccentue
          :texte="section.surtitre"
          :vars="vars"
          as="p"
          class="font-display text-xs font-semibold uppercase tracking-[0.3em] text-gold"
        />
        <TexteAccentue
          :texte="section.titre"
          :vars="vars"
          as="h2"
          class="mt-3 max-w-xl font-display text-3xl font-bold leading-tight md:text-4xl"
        />

        <template v-if="!termine">
          <div class="mt-10 flex gap-1.5" aria-hidden="true">
            <span
              v-for="n in NOMBRE_ETAPES"
              :key="n"
              class="h-1 flex-1 rounded-full transition-colors"
              :class="n - 1 <= etapeIndex ? 'bg-white' : 'bg-white/20'"
            />
          </div>
          <p class="sr-only" role="status" aria-live="polite">Étape {{ etapeIndex + 1 }} sur {{ NOMBRE_ETAPES }}</p>

          <Transition name="assistant-fade" mode="out-in" @after-enter="focuserEtape">
            <div :key="etapeIndex" class="mt-8">
              <!-- Étapes 1-4 : question à choix -->
              <fieldset v-if="etapeCourante">
                <legend tabindex="-1" class="font-display text-xl font-semibold outline-none">
                  {{ etapeCourante.question }}
                </legend>
                <p class="mt-2 max-w-lg text-sm text-white/70">{{ etapeCourante.aide }}</p>

                <div class="mt-6 flex flex-wrap gap-3">
                  <label v-for="option in etapeCourante.options" :key="option.value" class="relative">
                    <input
                      type="radio"
                      class="peer sr-only"
                      :name="etapeCourante.cle"
                      :value="option.value"
                      :checked="valeurCourante === option.value"
                      @change="setValeur(option.value)"
                    >
                    <span
                      class="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-white/25 px-5 py-3 text-sm font-medium transition-colors peer-checked:border-white peer-checked:bg-white peer-checked:text-navy peer-focus-visible:ring-2 peer-focus-visible:ring-white peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-navy"
                    >
                      <Check v-if="valeurCourante === option.value" :size="16" aria-hidden="true" />
                      {{ option.label }}
                    </span>
                  </label>
                </div>

                <div class="mt-10 flex flex-wrap items-center gap-3">
                  <button v-if="etapeIndex > 0" type="button" :class="CONTROLE_BASE" @click="retour">
                    <ArrowLeft :size="16" aria-hidden="true" /> Retour
                  </button>
                  <button type="button" :disabled="!valeurCourante" :class="BOUTON_PRIMAIRE" @click="continuer"
                  >
                    Continuer
                    <ArrowRight :size="16" aria-hidden="true" class="transition-transform group-hover:translate-x-0.5" />
                  </button>
                  <span class="text-xs text-white/70" aria-hidden="true">Étape {{ etapeIndex + 1 }} sur {{ NOMBRE_ETAPES }}</span>
                </div>
              </fieldset>

              <!-- Étape 5 : coordonnées -->
              <form v-else ref="contactFormRef" method="post" novalidate :aria-busy="envoiEnCours" @submit="onSubmitContact">
                <fieldset :disabled="envoiEnCours">
                  <legend tabindex="-1" class="font-display text-xl font-semibold outline-none">
                    {{ ETAPE_CONTACT.question }}
                  </legend>
                  <p class="mt-2 max-w-lg text-sm text-white/70">{{ ETAPE_CONTACT.aide }}</p>

                  <div class="mt-6 grid gap-5 sm:grid-cols-2">
                    <ChampContact :champ="CHAMP_NOM" tone="sombre" />
                    <ChampContact :champ="CHAMP_ENTREPRISE" tone="sombre" />
                  </div>

                  <div class="mt-5 grid gap-5 sm:grid-cols-2">
                    <ChampContact :champ="CHAMP_EMAIL" tone="sombre" />
                    <ChampContact :champ="CHAMP_TELEPHONE" tone="sombre" />
                  </div>

                  <FormField v-slot="{ componentField }" name="website">
                    <HoneypotField v-bind="componentField" />
                  </FormField>

                  <div class="mt-10 flex flex-wrap items-center gap-3">
                    <button type="button" :class="CONTROLE_BASE" @click="retour">
                      <ArrowLeft :size="16" aria-hidden="true" /> Retour
                    </button>
                    <Button type="submit" :disabled="verrouille" :class="BOUTON_PRIMAIRE">
                      {{ envoiEnCours ? 'Envoi en cours…' : ASSISTANT_FORM.bouton }}
                      <Send :size="16" aria-hidden="true" class="transition-transform group-hover:translate-x-0.5" />
                    </Button>
                    <span class="text-xs text-white/70" aria-hidden="true">Étape {{ NOMBRE_ETAPES }} sur {{ NOMBRE_ETAPES }}</span>
                  </div>

                  <MentionConfidentialite :texte="mention" :vars="vars" tone="sombre" class="mt-6" />
                </fieldset>
              </form>
            </div>
          </Transition>
        </template>

        <div v-else class="mt-10">
          <h3 ref="panelHeadingRef" tabindex="-1" class="font-display text-xl font-semibold outline-none">
            Notre recommandation
          </h3>
          <p class="mt-3 max-w-2xl text-white/80">{{ recommandationTexte }}</p>

          <dl v-if="recapFinal" class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div v-for="reponse in recapFinal" :key="reponse.libelle">
              <dt class="text-xs uppercase tracking-widest text-white/70">{{ reponse.libelle }}</dt>
              <dd class="mt-1 text-sm font-medium">{{ reponse.valeur }}</dd>
            </div>
          </dl>

          <TexteAccentue :texte="section.mentionDelai" :vars="vars" as="p" class="mt-8 text-sm text-white/70" />

          <button type="button" :class="`mt-6 ${CONTROLE_BASE}`" @click="recommencer">
            <RotateCcw :size="16" aria-hidden="true" /> Recommencer
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.assistant-fade-enter-active,
.assistant-fade-leave-active {
  transition: opacity 0.2s ease;
}
.assistant-fade-enter-from,
.assistant-fade-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .assistant-fade-enter-active,
  .assistant-fade-leave-active {
    transition: none;
  }
}
</style>
