<script setup lang="ts">
// Carte formulaire de /{filiale}/contact — pilotée entièrement par `CONTACT_FORMS[slug]` (spec
// lot 2 §4) : aucun `if (slug === …)` ici, le rendu de chaque champ vient de `ChampContact`.
// Même machine d'états que HoldingContactForm (soumission native impossible avant hydratation,
// focus sur le 1er champ invalide, honeypot, `method="post"`) — seule la source des champs change.
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { Send } from '@lucide/vue'
import {
  CONTACT_FORMS,
  estChampDetail,
  type ChampContact as ChampContactConfig,
  type FormulaireFilialeSlug,
} from '#shared/config/contact-forms'
import { filialeContactFormSchema, type FilialeContactFormValues } from '#shared/validation/contact'
import type { TexteVars } from '#shared/utils/texte'
import { usePublicFormSubmit } from '@/composables/usePublicFormSubmit'
import { usePublicFormFeedback } from '@/composables/usePublicFormFeedback'
import { FormField } from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import ChampContact from '@/components/site/contact/ChampContact.vue'
import HoneypotField from '@/components/site/form/HoneypotField.vue'
import MentionConfidentialite from '@/components/site/form/MentionConfidentialite.vue'

const props = defineProps<{
  slug: FormulaireFilialeSlug
  vars: TexteVars
  messageSucces: string | null
  mention: string | null
  emailSecours: string | null
}>()

const cfg = computed(() => CONTACT_FORMS[props.slug])

/** `''` partout (VeeValidate a besoin de valeurs initiales explicites, cf. HoldingContactForm) ;
 * `telephone`/`entreprise` seulement s'ils sont dans la config de cette filiale (spec §4). */
function valeursInitiales(config: (typeof CONTACT_FORMS)[FormulaireFilialeSlug]): FilialeContactFormValues {
  const details = Object.fromEntries(config.champs.filter(estChampDetail).map((champ) => [champ.cle, '']))
  const valeurs: Record<string, unknown> = { nom: '', email: '', message: '', website: '', details }
  if (config.champs.some((champ) => champ.type === 'telephone')) valeurs.telephone = ''
  if (config.champs.some((champ) => champ.type === 'entreprise')) valeurs.entreprise = ''
  // Seul cast du fichier : la forme exacte dépend de la config (runtime), le type statique de
  // FilialeContactFormValues est l'enveloppe commune aux 6 filiales (couverte par les tests T0).
  return valeurs as unknown as FilialeContactFormValues
}

const schema = computed(() => toTypedSchema(filialeContactFormSchema(props.slug)))
const { handleSubmit, resetForm } = useForm({
  validationSchema: schema,
  initialValues: valeursInitiales(cfg.value),
})

type FilialeContactBody = FilialeContactFormValues & { formulaire: FormulaireFilialeSlug }

const { envoyer, envoiEnCours } = usePublicFormSubmit<FilialeContactBody>('/api/public/contact')
const { notifierResultat } = usePublicFormFeedback()

// Soumission native impossible avant hydratation (même raison que HoldingContactForm) : pas de
// POST déguisé en GET.
const hydrate = ref(false)
onMounted(() => {
  hydrate.value = true
})

const formRef = ref<HTMLFormElement | null>(null)

const onSubmit = handleSubmit(
  async (values) => {
    const resultat = await envoyer({ formulaire: props.slug, ...values } as FilialeContactBody)
    const succes = notifierResultat(resultat, {
      titreSucces: cfg.value.toastTitre,
      messageSucces: props.messageSucces,
      vars: props.vars,
      emailSecours: props.emailSecours,
    })
    if (succes) resetForm()
  },
  // L'ordre du DOM suit l'ordre de la config : pas besoin de refs par champ, contrairement à
  // HoldingContactForm (nombre de champs fixe et connu à l'avance).
  async () => {
    await nextTick()
    formRef.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  },
)

const cleChamp = (champ: ChampContactConfig) => (estChampDetail(champ) ? champ.cle : champ.type)
</script>

<template>
  <form
    ref="formRef"
    method="post"
    novalidate
    :aria-busy="envoiEnCours"
    class="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:delay-100 rounded-[1.5rem] bg-white p-6 shadow-lg ring-1 ring-border sm:p-8 md:p-10"
    @submit="onSubmit"
  >
    <fieldset :disabled="envoiEnCours" class="space-y-6">
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChampContact v-for="champ in cfg.champs" :key="cleChamp(champ)" :champ="champ" />
      </div>

      <FormField v-slot="{ componentField }" name="website">
        <HoneypotField v-bind="componentField" />
      </FormField>

      <div class="space-y-4">
        <Button
          type="submit"
          :disabled="!hydrate || envoiEnCours"
          class="group inline-flex min-h-12 items-center gap-2 rounded-full bg-site-accent-strong px-7 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60"
        >
          {{ envoiEnCours ? 'Envoi en cours…' : cfg.bouton }}
          <Send :size="16" aria-hidden="true" class="transition-transform group-hover:translate-x-0.5" />
        </Button>
        <MentionConfidentialite :texte="mention" :vars="vars" />
      </div>
    </fieldset>
  </form>
</template>
