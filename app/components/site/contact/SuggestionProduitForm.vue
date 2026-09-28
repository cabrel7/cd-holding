<script setup lang="ts">
// Suggestion de produit — ccdpaa et boissons seulement (spec lot 2 §1, §4, Q-11). Carte séparée
// sous le formulaire de contact filiale, affichée par la page appelante seulement si la section
// éditable `CONTACT:suggestion` existe pour ce site. Écarts assumés vs le prototype (§0 CHALLENGE
// de la spec) : sans icône Lightbulb décorative, toast sans reprendre la saisie de l'utilisateur.
import { useForm } from 'vee-validate'
import { Send } from '@lucide/vue'
import { toTypedSchema } from '@vee-validate/zod'
import { CONTACT_LIMITS, suggestionFormSchema, type SuggestionFormValues } from '#shared/validation/contact'
import { SUGGESTION_FORM, type SiteSuggestion } from '#shared/config/contact-forms'
import type { TexteVars } from '#shared/utils/texte'
import type { FormulaireData } from '@/composables/useSiteSections'
import { usePublicFormSubmit } from '@/composables/usePublicFormSubmit'
import { usePublicFormFeedback } from '@/composables/usePublicFormFeedback'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import HoneypotField from '@/components/site/form/HoneypotField.vue'
import MentionConfidentialite from '@/components/site/form/MentionConfidentialite.vue'
import TexteAccentue from '@/components/site/TexteAccentue.vue'

const TITRE_REPLI = 'Vous ne trouvez pas ce que vous cherchez ?'

const props = defineProps<{
  site: SiteSuggestion
  section: FormulaireData | undefined
  vars: TexteVars
  mention: string | null
  emailSecours: string | null
}>()

type SuggestionBody = SuggestionFormValues & { formulaire: 'suggestion'; site: SiteSuggestion }

const schema = toTypedSchema(suggestionFormSchema)
const { handleSubmit, resetForm } = useForm({
  validationSchema: schema,
  initialValues: { nom: '', email: '', produitSouhaite: '', paysOrigine: '', message: '', website: '' },
})

const { envoyer, envoiEnCours } = usePublicFormSubmit<SuggestionBody>('/api/public/contact')
const { notifierResultat } = usePublicFormFeedback()

const hydrate = ref(false)
onMounted(() => {
  hydrate.value = true
})

const formRef = ref<HTMLFormElement | null>(null)

const onSubmit = handleSubmit(
  async (values) => {
    const resultat = await envoyer({ formulaire: 'suggestion', site: props.site, ...values })
    const succes = notifierResultat(resultat, {
      titreSucces: SUGGESTION_FORM.toastTitre,
      messageSucces: props.section?.messageSucces,
      vars: props.vars,
      emailSecours: props.emailSecours,
    })
    if (succes) resetForm()
  },
  async () => {
    await nextTick()
    formRef.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  },
)
</script>

<template>
  <section class="pb-24 md:pb-32">
    <div class="mx-auto max-w-5xl px-6">
      <div class="rounded-[1.5rem] bg-white p-8 shadow-lg ring-1 ring-border md:p-12">
        <TexteAccentue
          :texte="section?.titre ?? TITRE_REPLI"
          :vars="vars"
          as="h2"
          class="font-display text-3xl font-bold leading-tight text-navy"
        />
        <TexteAccentue
          v-if="section?.texte"
          :texte="section.texte"
          :vars="vars"
          as="p"
          class="mt-3 max-w-xl leading-relaxed text-ink/75"
        />

        <form
          ref="formRef"
          method="post"
          novalidate
          :aria-busy="envoiEnCours"
          class="mt-8 space-y-6"
          @submit="onSubmit"
        >
          <fieldset :disabled="envoiEnCours" class="space-y-6">
            <div class="grid gap-6 lg:grid-cols-2">
              <FormField v-slot="{ componentField }" name="nom">
                <FormItem>
                  <FormLabel class="font-display text-xs font-semibold uppercase tracking-widest text-navy">
                    Nom
                  </FormLabel>
                  <FormControl>
                    <Input
                      v-bind="componentField"
                      autocomplete="name"
                      :maxlength="CONTACT_LIMITS.nomMax"
                      placeholder="Jean Tremblay"
                      class="h-12 rounded-xl bg-white px-4"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>

              <FormField v-slot="{ componentField }" name="email">
                <FormItem>
                  <FormLabel class="font-display text-xs font-semibold uppercase tracking-widest text-navy">
                    Courriel
                  </FormLabel>
                  <FormControl>
                    <Input
                      v-bind="componentField"
                      type="email"
                      autocomplete="email"
                      :spellcheck="false"
                      :maxlength="CONTACT_LIMITS.emailMax"
                      placeholder="vous@exemple.ca"
                      class="h-12 rounded-xl bg-white px-4"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>
            </div>

            <div class="grid gap-6 lg:grid-cols-2">
              <FormField v-slot="{ componentField }" name="produitSouhaite">
                <FormItem>
                  <FormLabel class="font-display text-xs font-semibold uppercase tracking-widest text-navy">
                    Produit souhaité
                  </FormLabel>
                  <FormControl>
                    <Input
                      v-bind="componentField"
                      :maxlength="CONTACT_LIMITS.texteCourtMax"
                      :placeholder="SUGGESTION_FORM.placeholdersProduit[site]"
                      class="h-12 rounded-xl bg-white px-4"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>

              <FormField v-slot="{ componentField }" name="paysOrigine">
                <FormItem>
                  <FormLabel class="font-display text-xs font-semibold uppercase tracking-widest text-navy">
                    Pays d’origine
                  </FormLabel>
                  <FormControl>
                    <Input
                      v-bind="componentField"
                      :maxlength="CONTACT_LIMITS.paysMax"
                      placeholder="Ex. Sénégal"
                      class="h-12 rounded-xl bg-white px-4"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>
            </div>

            <FormField v-slot="{ componentField }" name="message">
              <FormItem>
                <FormLabel class="font-display text-xs font-semibold uppercase tracking-widest text-navy">
                  Pourquoi ce produit ?
                </FormLabel>
                <FormControl>
                  <Textarea
                    v-bind="componentField"
                    rows="3"
                    :maxlength="CONTACT_LIMITS.messageMax"
                    placeholder="Demande de votre clientèle, volume estimé, saisonnalité…"
                    class="resize-none rounded-xl bg-white px-4 py-3"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="website">
              <HoneypotField v-bind="componentField" />
            </FormField>

            <div class="space-y-4">
              <Button
                type="submit"
                :disabled="!hydrate || envoiEnCours"
                class="group inline-flex min-h-12 items-center gap-2 rounded-full bg-site-accent-strong px-7 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60"
              >
                {{ envoiEnCours ? 'Envoi en cours…' : SUGGESTION_FORM.bouton }}
                <Send :size="16" aria-hidden="true" class="transition-transform group-hover:translate-x-0.5" />
              </Button>
              <MentionConfidentialite :texte="mention" :vars="vars" />
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  </section>
</template>
