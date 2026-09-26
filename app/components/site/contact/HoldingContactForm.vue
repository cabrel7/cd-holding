<script setup lang="ts">
// Carte formulaire de /contact — spécifique holding (sélecteur de filiale cible), spec §4.1,
// §4.3. VeeValidate + toTypedSchema(holdingContactFormSchema) : source unique de validation
// client/serveur (shared/validation/contact.ts). Le composable d'envoi ne gère aucun toast
// (usePublicFormSubmit) : la machine d'états ci-dessous traduit chaque issue en toast et décide
// seule de vider ou non le formulaire.
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { toast } from 'vue-sonner'
import { ChevronDown, Send } from '@lucide/vue'
import { holdingContactFormSchema, type HoldingContactFormValues } from '#shared/validation/contact'
import { interpoler, type TexteVars } from '#shared/utils/texte'
import type { PublicSiteSummary } from '#shared/types/public'
import { usePublicFormSubmit } from '@/composables/usePublicFormSubmit'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import HoneypotField from '@/components/site/form/HoneypotField.vue'
import MentionConfidentialite from '@/components/site/form/MentionConfidentialite.vue'

const SECONDES_PAR_MINUTE = 60
const MESSAGE_SUCCES_REPLI = 'Votre message a bien été reçu.'

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
const { handleSubmit, defineField, resetForm } = useForm({ validationSchema: schema })

const [nom, nomAttrs] = defineField('nom')
const [email, emailAttrs] = defineField('email')
const [cible, cibleAttrs] = defineField('cible')
const [message, messageAttrs] = defineField('message')
const [website] = defineField('website')

const { envoyer, envoiEnCours } = usePublicFormSubmit<HoldingContactBody>('/api/public/contact')

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

const onSubmit = handleSubmit(
  async (values) => {
    const resultat = await envoyer({ formulaire: 'holding', ...values })

    if (resultat.ok) {
      toast.success('Message envoyé', {
        description: props.messageSucces ? interpoler(props.messageSucces, props.vars) : MESSAGE_SUCCES_REPLI,
      })
      resetForm()
      return
    }

    if (resultat.raison === 'validation') {
      toast.error('Certaines informations sont invalides. Vérifiez le formulaire.')
      return
    }

    if (resultat.raison === 'trop-de-requetes') {
      const minutes =
        resultat.retryAfterSeconds != null ? Math.ceil(resultat.retryAfterSeconds / SECONDES_PAR_MINUTE) : null
      toast.error('Trop d’envois depuis votre connexion.', {
        description: minutes != null ? `Réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.` : 'Réessayez dans quelques minutes.',
      })
      return
    }

    toast.error('L’envoi a échoué. Réessayez dans un instant.', {
      description: props.emailSecours ? `Vous pouvez aussi nous écrire à ${props.emailSecours}` : undefined,
    })
  },
  ({ errors: invalidErrors }) => {
    if (invalidErrors.nom) focusOn(nomInputRef.value)
    else if (invalidErrors.email) focusOn(emailInputRef.value)
    else if (invalidErrors.cible) focusOn(cibleSelectRef.value)
    else if (invalidErrors.message) focusOn(messageInputRef.value)
  },
)
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
                v-model="cible"
                v-bind="cibleAttrs"
                class="h-12 w-full appearance-none rounded-xl border border-input bg-white px-4 pr-10 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
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
              class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink/50"
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
          :disabled="!hydrate || envoiEnCours"
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
