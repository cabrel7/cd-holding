<script setup lang="ts">
// Carte formulaire de /contact — spécifique holding (sélecteur de filiale cible), spec §4.1,
// §4.3. VeeValidate + toTypedSchema(holdingContactFormSchema) : source unique de validation
// client/serveur (shared/validation/contact.ts). Le composable d'envoi ne gère aucun toast
// (usePublicFormSubmit) : la traduction résultat → toast vit dans usePublicFormFeedback (spec
// lot 2 §4, partagée avec les formulaires filiales/suggestion) ; ce composant garde la décision
// de vider ou non le formulaire (`resetForm`, propre à sa propre instance `useForm`).
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { ChevronDown, Send } from '@lucide/vue'
import { holdingContactFormSchema, type HoldingContactFormValues } from '#shared/validation/contact'
import type { TexteVars } from '#shared/utils/texte'
import type { PublicSiteSummary } from '#shared/types/public'
import { isSiteSlug } from '#shared/config/sites'
import { usePublicFormSubmit } from '@/composables/usePublicFormSubmit'
import { usePublicFormFeedback } from '@/composables/usePublicFormFeedback'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import HoneypotField from '@/components/site/form/HoneypotField.vue'
import MentionConfidentialite from '@/components/site/form/MentionConfidentialite.vue'

const props = defineProps<{
  filiales: readonly PublicSiteSummary[] | null
  groupe: string
  vars: TexteVars
  messageSucces: string | null
  mention: string | null
  emailSecours: string | null
}>()

type HoldingContactBody = HoldingContactFormValues & { formulaire: 'holding' }

const schema = toTypedSchema(holdingContactFormSchema)
// Valeurs initiales explicites : sans elles, les champs partent à `undefined` et zod renvoie son
// message par défaut (« Required », en anglais) au lieu des messages `.min()` du schéma partagé.
// `cible` reste `undefined` (aucun choix) : `cibleChoisie` le présente au <select> comme `''`,
// la valeur de l'option d'invite, qui s'affiche donc au chargement et après `resetForm()`.
const { handleSubmit, defineField, resetForm } = useForm({
  validationSchema: schema,
  initialValues: { nom: '', email: '', message: '', website: '' },
})

const [nom, nomAttrs] = defineField('nom')
const [email, emailAttrs] = defineField('email')
const [cible, cibleAttrs] = defineField('cible')
const cibleChoisie = computed<string>({
  get: () => cible.value ?? '',
  set: (valeur) => {
    cible.value = isSiteSlug(valeur) ? valeur : undefined
  },
})
const [message, messageAttrs] = defineField('message')
const [website] = defineField('website')

const { envoyer, envoiEnCours, verrouille, soumettre } = usePublicFormSubmit<HoldingContactBody>('/api/public/contact')
const { notifierResultat } = usePublicFormFeedback()

// Soumission native impossible avant hydratation (bug 12, §4.3) : pas de POST déguisé en GET.
const hydrate = ref(false)
onMounted(() => {
  hydrate.value = true
})

const nomInputRef = ref<unknown>(null)
const emailInputRef = ref<unknown>(null)
const cibleSelectRef = ref<HTMLSelectElement | null>(null)
const messageInputRef = ref<unknown>(null)

/** Déballe `$el` d'un composant shadcn (Input/Textarea) ou accepte un élément natif direct. */
function focusOn(target: unknown): void {
  const el = target && typeof target === 'object' && '$el' in target ? (target as { $el: unknown }).$el : target
  if (el instanceof HTMLElement) el.focus()
}

const onSubmit = soumettre(handleSubmit(
  async (values) => {
    const resultat = await envoyer({ formulaire: 'holding', ...values })
    const succes = notifierResultat(resultat, {
      titreSucces: 'Message envoyé',
      messageSucces: props.messageSucces,
      vars: props.vars,
      emailSecours: props.emailSecours,
    })
    if (succes) resetForm()
  },
  ({ errors: invalidErrors }) => {
    if (invalidErrors.nom) focusOn(nomInputRef.value)
    else if (invalidErrors.email) focusOn(emailInputRef.value)
    else if (invalidErrors.cible) focusOn(cibleSelectRef.value)
    else if (invalidErrors.message) focusOn(messageInputRef.value)
  },
))
</script>

<template>
  <form
    method="post"
    novalidate
    :aria-busy="envoiEnCours"
    class="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:delay-100 rounded-[1.5rem] bg-white p-6 shadow-lg ring-1 ring-border sm:p-8 md:p-10"
    @submit="onSubmit"
  >
    <fieldset :disabled="envoiEnCours" class="space-y-6">
      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <FormField name="nom">
          <FormItem>
            <FormLabel class="font-display text-xs font-semibold uppercase tracking-widest text-navy">
              Nom complet
            </FormLabel>
            <FormControl>
              <Input
                ref="nomInputRef"
                v-model="nom"
                v-bind="nomAttrs"
                autocomplete="name"
                maxlength="120"
                placeholder="Jean Tremblay"
                class="h-12 rounded-xl bg-white px-4"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField name="email">
          <FormItem>
            <FormLabel class="font-display text-xs font-semibold uppercase tracking-widest text-navy">
              Courriel
            </FormLabel>
            <FormControl>
              <Input
                ref="emailInputRef"
                v-model="email"
                v-bind="emailAttrs"
                type="email"
                autocomplete="email"
                spellcheck="false"
                maxlength="254"
                placeholder="vous@exemple.ca"
                class="h-12 rounded-xl bg-white px-4"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
      </div>

      <FormField name="cible">
        <FormItem>
          <FormLabel class="font-display text-xs font-semibold uppercase tracking-widest text-navy">
            Filiale concernée
          </FormLabel>
          <!-- FormControl (Slot reka-ui) pose id / aria-invalid / aria-describedby sur son enfant
               direct : ce doit être le <select>, pas l'enrobage de l'icône, sinon le label ne
               désigne aucun contrôle. -->
          <div class="relative">
            <FormControl>
              <select
                ref="cibleSelectRef"
                v-model="cibleChoisie"
                v-bind="cibleAttrs"
                class="h-12 w-full appearance-none rounded-xl border border-input bg-white px-4 pr-10 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm aria-invalid:border-destructive aria-invalid:ring-destructive/20"
              >
                <option value="" disabled>Sélectionnez une filiale</option>
                <option value="holding">Le {{ groupe }} (général)</option>
                <option v-for="filiale in filiales ?? []" :key="filiale.uuid" :value="filiale.slug">
                  {{ filiale.nom }}
                </option>
              </select>
            </FormControl>
            <ChevronDown
              :size="18"
              aria-hidden="true"
              class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink/70"
            />
          </div>
          <FormMessage />
        </FormItem>
      </FormField>

      <FormField name="message">
        <FormItem>
          <FormLabel class="font-display text-xs font-semibold uppercase tracking-widest text-navy">
            Votre message
          </FormLabel>
          <FormControl>
            <Textarea
              ref="messageInputRef"
              v-model="message"
              v-bind="messageAttrs"
              rows="5"
              maxlength="5000"
              placeholder="Dites-nous en un peu plus…"
              class="resize-none rounded-xl bg-white px-4 py-3"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>

      <HoneypotField v-model="website" />

      <div class="space-y-4">
        <Button
          type="submit"
          :disabled="!hydrate || verrouille"
          class="group inline-flex min-h-12 items-center gap-2 rounded-full bg-site-accent px-7 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60"
        >
          {{ envoiEnCours ? 'Envoi en cours…' : 'Envoyer le message' }}
          <Send :size="16" aria-hidden="true" class="transition-transform group-hover:translate-x-0.5" />
        </Button>
        <MentionConfidentialite :texte="mention" :vars="vars" />
      </div>
    </fieldset>
  </form>
</template>
