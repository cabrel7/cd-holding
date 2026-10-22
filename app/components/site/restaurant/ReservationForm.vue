<script setup lang="ts">
// Réservation du restaurant (cdpaa) — spec lot3 §3/§4. Carte `bg-site-accent-strong` (écart
// assumé au prototype : texte blanc au lieu de #BA7517+blanc, contraste 3,6 → sous l'AA).
// Champs nom/téléphone/courriel via
// <ChampContact tone="sombre"> et mention via <MentionConfidentialite tone="sombre"> ; les champs
// propres à la réservation (date, créneaux, personnes, notes) réutilisent les mêmes classes
// partagées (app/utils/formClasses.ts). Les créneaux et le plafond de personnes viennent
// uniquement des réglages (`ReglagesRestaurant`, via `creneauxPourDate`/`reglages`) — aucun
// horaire en dur.
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { ChevronDown, Send } from '@lucide/vue'
import { reservationSchema, RESERVATION_LIMITS, type ReservationBody, type ReservationFormValues } from '#shared/validation/reservation'
import type { ChampContact as ChampContactConfig } from '#shared/config/contact-forms'
import { bornesDates, creneauxPourDate, libelleHeure } from '#shared/utils/restaurant'
import type { PublicRestaurantDto } from '#shared/types/public'
import type { TexteVars } from '#shared/utils/texte'
import type { FormulaireData } from '@/composables/useSiteSections'
import { usePublicFormSubmit } from '@/composables/usePublicFormSubmit'
import { usePublicFormFeedback } from '@/composables/usePublicFormFeedback'
import {
  CONTROLE_SOMBRE,
  FOCUS_CARTE_SOMBRE,
  LABEL_SOMBRE,
  SELECT_CLASS_SOMBRE,
  TEXTAREA_SOMBRE,
} from '@/utils/formClasses'
import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import ChampContact from '@/components/site/contact/ChampContact.vue'
import MentionConfidentialite from '@/components/site/form/MentionConfidentialite.vue'
import MessageChamp from '@/components/site/form/MessageChamp.vue'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import HoneypotField from '@/components/site/form/HoneypotField.vue'
import TexteAccentue from '@/components/site/TexteAccentue.vue'

const TITRE_REPLI = 'Réserver une table'
const TOAST_TITRE = 'Réservation reçue'
const CHAMP_NOM: ChampContactConfig = { type: 'nom', label: 'Nom', placeholder: 'Jean Tremblay' }
const CHAMP_TELEPHONE: ChampContactConfig = { type: 'telephone', label: 'Téléphone', placeholder: '514-000-0000' }
const CHAMP_EMAIL: ChampContactConfig = { type: 'email', label: 'Courriel', placeholder: 'vous@exemple.ca' }

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

const { envoyer, envoiEnCours, verrouille, soumettre } = usePublicFormSubmit<ReservationBody>('/api/public/restaurant/reservations')
const { notifierResultat } = usePublicFormFeedback()
const { href } = useSiteLinks()

// Lien contact (D7) : nu sur le sous-domaine cdpaa, préfixé /cdpaa ailleurs (dev inchangé).
const lienContact = computed(() => href('cdpaa', '/contact').to)

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

const onSubmit = soumettre(handleSubmit(
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
))
</script>

<template>
  <section class="pb-24 md:pb-32">
    <div class="mx-auto max-w-4xl px-6">
      <form
        ref="formRef"
        method="post"
        novalidate
        :aria-busy="envoiEnCours"
        class="rounded-[1.5rem] bg-site-accent-strong p-8 text-white shadow-2xl [--carte-fond:var(--site-accent-strong)] md:p-12"
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
            <ChampContact :champ="CHAMP_NOM" tone="sombre" />
            <ChampContact :champ="CHAMP_TELEPHONE" tone="sombre" />
          </div>

          <ChampContact :champ="CHAMP_EMAIL" tone="sombre" />

          <div class="grid gap-5 md:grid-cols-3">
            <FormField v-slot="{ componentField }" name="date">
              <FormItem>
                <FormLabel :class="LABEL_SOMBRE">Date</FormLabel>
                <FormControl>
                  <Input v-bind="componentField" type="date" :min="dateMin" :max="dateMax" :class="CONTROLE_SOMBRE" />
                </FormControl>
                <MessageChamp />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="heure">
              <FormItem>
                <FormLabel :class="LABEL_SOMBRE">Heure</FormLabel>
                <div class="relative">
                  <FormControl>
                    <select
                      :value="componentField.modelValue ?? ''"
                      :name="componentField.name"
                      :disabled="!values.date || creneaux.length === 0"
                      :class="SELECT_CLASS_SOMBRE"
                      @change="componentField['onUpdate:modelValue']?.(($event.target as HTMLSelectElement).value)"
                      @blur="componentField.onBlur"
                    >
                      <option value="" disabled :selected="!componentField.modelValue">{{ !values.date ? 'Choisissez une date' : 'Sélectionnez' }}</option>
                      <option v-for="h in creneaux" :key="h" :value="h">{{ libelleHeure(h) }}</option>
                    </select>
                  </FormControl>
                  <ChevronDown :size="18" aria-hidden="true" class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink/70" />
                </div>
                <p v-if="values.date && creneaux.length === 0" class="text-sm text-white/85">Aucun créneau ce jour-là.</p>
                <MessageChamp />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="nombrePersonnes">
              <FormItem>
                <FormLabel :class="LABEL_SOMBRE">Personnes</FormLabel>
                <div class="relative">
                  <FormControl>
                    <select
                      :value="componentField.modelValue ?? ''"
                      :name="componentField.name"
                      :class="SELECT_CLASS_SOMBRE"
                      @change="componentField['onUpdate:modelValue']?.(($event.target as HTMLSelectElement).value)"
                      @blur="componentField.onBlur"
                    >
                      <option value="" disabled>Sélectionnez</option>
                      <option v-for="n in nombresPersonnesOptions" :key="n" :value="n">{{ n }}</option>
                    </select>
                  </FormControl>
                  <ChevronDown :size="18" aria-hidden="true" class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink/70" />
                </div>
                <MessageChamp />
              </FormItem>
            </FormField>
          </div>
          <p class="-mt-2 text-xs text-white/85">
            Plus de {{ reglages.capaciteMaxReservation }} personnes ?
            <NuxtLink :to="lienContact" class="rounded-sm py-3 underline underline-offset-2 hover:text-white" :class="FOCUS_CARTE_SOMBRE">Écrivez-nous</NuxtLink>
          </p>

          <FormField v-slot="{ componentField }" name="notes">
            <FormItem>
              <FormLabel :class="LABEL_SOMBRE">Notes (facultatif)</FormLabel>
              <FormControl>
                <Textarea
                  v-bind="componentField"
                  rows="2"
                  :maxlength="RESERVATION_LIMITS.notesMax"
                  placeholder="Allergies, occasion spéciale…"
                  :class="TEXTAREA_SOMBRE"
                />
              </FormControl>
              <MessageChamp />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="website">
            <HoneypotField v-bind="componentField" />
          </FormField>

          <div class="space-y-4">
            <Button
              type="submit"
              :disabled="!hydrate || verrouille"
              :class="`group inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-7 text-sm font-semibold text-site-accent-strong transition-colors hover:bg-cream disabled:opacity-60 ${FOCUS_CARTE_SOMBRE}`"
            >
              {{ envoiEnCours ? 'Envoi en cours…' : 'Réserver ma table' }}
              <Send :size="16" aria-hidden="true" class="transition-transform group-hover:translate-x-0.5" />
            </Button>
            <MentionConfidentialite :texte="mention" :vars="vars" tone="sombre" />
          </div>
        </fieldset>
      </form>
    </div>
  </section>
</template>
