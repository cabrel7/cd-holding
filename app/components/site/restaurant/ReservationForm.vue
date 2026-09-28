<script setup lang="ts">
// Réservation du restaurant (ccdpaa) — spec lot3 §3/§4. Carte `bg-site-accent-strong` (écart
// assumé au prototype : texte blanc au lieu de #BA7517+blanc, contraste 3,6 → sous l'AA).
// Champs nom/téléphone/courriel volontairement PAS rendus via <ChampContact> (contrairement à
// la suggestion littérale de la spec) : son FormLabel est fixé en `text-navy`, illisible sur ce
// fond sombre (mesuré : ~1,9:1, sous l'AA). Même raison pour ne pas réutiliser
// <MentionConfidentialite> (texte fixé en `text-ink/70`) : le contenu est repris à l'identique,
// seule la teinte change. Les créneaux et le plafond de personnes viennent uniquement des
// réglages (`ReglagesRestaurant`, via `creneauxPourDate`/`reglages`) — aucun horaire en dur.
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { ChevronDown, Send } from '@lucide/vue'
import { reservationSchema, RESERVATION_LIMITS, type ReservationBody, type ReservationFormValues } from '#shared/validation/reservation'
import { CONTACT_LIMITS } from '#shared/validation/contact'
import { bornesDates, creneauxPourDate, libelleHeure } from '#shared/utils/restaurant'
import type { PublicRestaurantDto } from '#shared/types/public'
import type { TexteVars } from '#shared/utils/texte'
import type { FormulaireData } from '@/composables/useSiteSections'
import { usePublicFormSubmit } from '@/composables/usePublicFormSubmit'
import { usePublicFormFeedback } from '@/composables/usePublicFormFeedback'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import HoneypotField from '@/components/site/form/HoneypotField.vue'
import TexteAccentue from '@/components/site/TexteAccentue.vue'

const TITRE_REPLI = 'Réserver une table'
const TOAST_TITRE = 'Réservation reçue'
const LABEL_CLASS = 'font-display text-xs font-semibold uppercase tracking-widest text-white/80'
const CONTROL_CLASS = 'h-12 rounded-xl bg-white px-4 text-ink'
const MESSAGE_CLASS = 'text-white'

const props = defineProps<{
  section: FormulaireData | undefined
  reglages: PublicRestaurantDto
  vars: TexteVars
  mention: string | null
  emailSecours: string | null
}>()

const schema = computed(() => toTypedSchema(reservationSchema(props.reglages)))
const initialValues: ReservationFormValues = {
  nom: '',
  email: '',
  telephone: '',
  date: '',
  heure: '',
  // Le <select> natif transmet une chaîne ; `z.coerce.number` la convertit à la validation.
  nombrePersonnes: '' as unknown as number,
  notes: '',
  website: '',
}

const { handleSubmit, resetForm, values, setFieldValue } = useForm<ReservationFormValues>({
  validationSchema: schema,
  initialValues,
})

const { envoyer, envoiEnCours } = usePublicFormSubmit<ReservationBody>('/api/public/restaurant/reservations')
const { notifierResultat } = usePublicFormFeedback()

// Bornes de date posées seulement après hydratation : les figer au rendu serveur les daterait
// du moment du build/ISR (même raison que ChampContact pour `date-future`).
const dateMin = ref<string | undefined>(undefined)
const dateMax = ref<string | undefined>(undefined)
const hydrate = ref(false)
onMounted(() => {
  const bornes = bornesDates(props.reglages)
  dateMin.value = bornes.min
  dateMax.value = bornes.max
  hydrate.value = true
})

const creneaux = computed(() => (values.date ? creneauxPourDate(props.reglages, values.date, new Date()) : []))
watch(creneaux, (options) => {
  if (values.heure && !options.includes(values.heure)) setFieldValue('heure', '')
})

const nombresPersonnesOptions = computed(() =>
  Array.from({ length: props.reglages.capaciteMaxReservation }, (_, i) => i + 1),
)

const formRef = ref<HTMLFormElement | null>(null)

const onSubmit = handleSubmit(
  async (v) => {
    const resultat = await envoyer(v as unknown as ReservationBody)
    const succes = notifierResultat(resultat, {
      titreSucces: TOAST_TITRE,
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
    <div class="mx-auto max-w-4xl px-6">
      <form
        ref="formRef"
        method="post"
        novalidate
        :aria-busy="envoiEnCours"
        class="rounded-[1.5rem] bg-site-accent-strong p-8 text-white shadow-2xl md:p-12"
        @submit="onSubmit"
      >
        <fieldset :disabled="envoiEnCours" class="space-y-6">
          <div>
            <TexteAccentue
              v-if="section?.surtitre"
              :texte="section.surtitre"
              :vars="vars"
              as="p"
              class="font-display text-xs font-semibold uppercase tracking-widest text-white/80"
            />
            <TexteAccentue
              :texte="section?.titre ?? reglages.nom ?? TITRE_REPLI"
              :vars="vars"
              as="h2"
              class="mt-3 font-display text-3xl font-bold md:text-4xl"
            />
            <TexteAccentue
              v-if="section?.texte"
              :texte="section.texte"
              :vars="vars"
              as="p"
              class="mt-3 max-w-xl text-sm leading-relaxed text-white/85"
            />
          </div>

          <div class="grid gap-5 md:grid-cols-2">
            <FormField v-slot="{ componentField }" name="nom">
              <FormItem>
                <FormLabel :class="LABEL_CLASS">Nom</FormLabel>
                <FormControl>
                  <Input
                    v-bind="componentField"
                    autocomplete="name"
                    :maxlength="CONTACT_LIMITS.nomMax"
                    placeholder="Jean Tremblay"
                    :class="CONTROL_CLASS"
                  />
                </FormControl>
                <FormMessage :class="MESSAGE_CLASS" />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="telephone">
              <FormItem>
                <FormLabel :class="LABEL_CLASS">Téléphone</FormLabel>
                <FormControl>
                  <Input
                    v-bind="componentField"
                    type="tel"
                    inputmode="tel"
                    autocomplete="tel"
                    :maxlength="CONTACT_LIMITS.telephoneMax"
                    placeholder="514-000-0000"
                    :class="CONTROL_CLASS"
                  />
                </FormControl>
                <FormMessage :class="MESSAGE_CLASS" />
              </FormItem>
            </FormField>
          </div>

          <FormField v-slot="{ componentField }" name="email">
            <FormItem>
              <FormLabel :class="LABEL_CLASS">Courriel</FormLabel>
              <FormControl>
                <Input
                  v-bind="componentField"
                  type="email"
                  autocomplete="email"
                  :spellcheck="false"
                  :maxlength="CONTACT_LIMITS.emailMax"
                  placeholder="vous@exemple.ca"
                  :class="CONTROL_CLASS"
                />
              </FormControl>
              <FormMessage :class="MESSAGE_CLASS" />
            </FormItem>
          </FormField>

          <div class="grid gap-5 md:grid-cols-3">
            <FormField v-slot="{ componentField }" name="date">
              <FormItem>
                <FormLabel :class="LABEL_CLASS">Date</FormLabel>
                <FormControl>
                  <Input v-bind="componentField" type="date" :min="dateMin" :max="dateMax" :class="CONTROL_CLASS" />
                </FormControl>
                <FormMessage :class="MESSAGE_CLASS" />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="heure">
              <FormItem>
                <FormLabel :class="LABEL_CLASS">Heure</FormLabel>
                <div class="relative">
                  <FormControl>
                    <select
                      :value="componentField.modelValue ?? ''"
                      :name="componentField.name"
                      :disabled="!values.date || creneaux.length === 0"
                      :class="`${CONTROL_CLASS} w-full appearance-none pr-10 disabled:opacity-60`"
                      @change="componentField['onUpdate:modelValue']?.(($event.target as HTMLSelectElement).value)"
                      @blur="componentField.onBlur"
                    >
                      <option value="" disabled>{{ !values.date ? 'Choisissez une date' : 'Sélectionnez' }}</option>
                      <option v-for="h in creneaux" :key="h" :value="h">{{ libelleHeure(h) }}</option>
                    </select>
                  </FormControl>
                  <ChevronDown :size="18" aria-hidden="true" class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink/70" />
                </div>
                <p v-if="values.date && creneaux.length === 0" class="text-sm text-white/85">Aucun créneau ce jour-là.</p>
                <FormMessage :class="MESSAGE_CLASS" />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="nombrePersonnes">
              <FormItem>
                <FormLabel :class="LABEL_CLASS">Personnes</FormLabel>
                <div class="relative">
                  <FormControl>
                    <select
                      :value="componentField.modelValue ?? ''"
                      :name="componentField.name"
                      :class="`${CONTROL_CLASS} w-full appearance-none pr-10`"
                      @change="componentField['onUpdate:modelValue']?.(($event.target as HTMLSelectElement).value)"
                      @blur="componentField.onBlur"
                    >
                      <option value="" disabled>Sélectionnez</option>
                      <option v-for="n in nombresPersonnesOptions" :key="n" :value="n">{{ n }}</option>
                    </select>
                  </FormControl>
                  <ChevronDown :size="18" aria-hidden="true" class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink/70" />
                </div>
                <FormMessage :class="MESSAGE_CLASS" />
              </FormItem>
            </FormField>
          </div>
          <p class="-mt-2 text-xs text-white/70">
            Plus de {{ reglages.capaciteMaxReservation }} personnes ?
            <NuxtLink to="/ccdpaa/contact" class="underline underline-offset-2 hover:text-white">Écrivez-nous</NuxtLink>
          </p>

          <FormField v-slot="{ componentField }" name="notes">
            <FormItem>
              <FormLabel :class="LABEL_CLASS">Notes (facultatif)</FormLabel>
              <FormControl>
                <Textarea
                  v-bind="componentField"
                  rows="2"
                  :maxlength="RESERVATION_LIMITS.notesMax"
                  placeholder="Allergies, occasion spéciale…"
                  class="resize-none rounded-xl bg-white px-4 py-3 text-ink"
                />
              </FormControl>
              <FormMessage :class="MESSAGE_CLASS" />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="website">
            <HoneypotField v-bind="componentField" />
          </FormField>

          <div class="space-y-4">
            <Button
              type="submit"
              :disabled="!hydrate || envoiEnCours"
              class="group inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-7 text-sm font-semibold text-site-accent-strong transition-transform hover:-translate-y-0.5 disabled:opacity-60"
            >
              {{ envoiEnCours ? 'Envoi en cours…' : 'Réserver ma table' }}
              <Send :size="16" aria-hidden="true" class="transition-transform group-hover:translate-x-0.5" />
            </Button>
            <p class="text-xs text-white/70">
              <TexteAccentue v-if="mention" :texte="mention" :vars="vars" as="span" />
              <NuxtLink to="/confidentialite" class="ml-1 underline underline-offset-2 hover:text-white">
                Politique de confidentialité
              </NuxtLink>
            </p>
          </div>
        </fieldset>
      </form>
    </div>
  </section>
</template>
