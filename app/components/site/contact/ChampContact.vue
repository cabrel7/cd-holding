<script setup lang="ts">
// Un champ d'un formulaire de contact filiale, piloté entièrement par sa config (spec lot 2 §4) :
// aucun `if (slug === …)` ici, seulement un rendu par `champ.type`. Le nom du champ vee-validate
// se déduit du type (`nom`/`email`/`telephone`/`entreprise`/`message` correspondent 1:1 aux clés
// du schéma racine) ou de `details.<cle>` pour les champs stockés dans `MessageContact.details`
// (`estChampDetail`, shared/config/contact-forms.ts).
// `:min`/`:max` de la date ne sont posés qu'après `onMounted` : les poser au rendu serveur les
// figerait à la date de build/ISR, potentiellement périmée au moment où la page est réellement
// servie au visiteur (spec §4, ligne ChampContact).
import { ChevronDown } from '@lucide/vue'
import { estChampDetail, type ChampContact } from '#shared/config/contact-forms'
import { CONTACT_LIMITS } from '#shared/validation/contact'
import { ajouterJoursIso, dateDuJourQuebec } from '#shared/utils/dates'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const props = defineProps<{ champ: ChampContact }>()

const nomChamp = computed(() => (estChampDetail(props.champ) ? `details.${props.champ.cle}` : props.champ.type))

const typeInput = computed(() => {
  switch (props.champ.type) {
    case 'email':
      return 'email'
    case 'telephone':
      return 'tel'
    case 'date-future':
      return 'date'
    case 'entier':
      return 'number'
    default:
      return 'text'
  }
})

const autocompleteInput = computed(() => {
  switch (props.champ.type) {
    case 'nom':
      return 'name'
    case 'email':
      return 'email'
    case 'telephone':
      return 'tel'
    case 'entreprise':
      return 'organization'
    default:
      return undefined
  }
})

const maxLengthInput = computed(() => {
  switch (props.champ.type) {
    case 'nom':
      return CONTACT_LIMITS.nomMax
    case 'email':
      return CONTACT_LIMITS.emailMax
    case 'telephone':
      return CONTACT_LIMITS.telephoneMax
    case 'entreprise':
      return CONTACT_LIMITS.entrepriseMax
    case 'texte':
      return CONTACT_LIMITS.texteCourtMax
    default:
      return undefined
  }
})

// Bornes numériques (champ `entier`), séparées de `maxLengthInput` : ce n'est pas une longueur
// de chaîne mais une valeur (`min`/`max` du composant de config), posée dès le rendu serveur.
const bornesEntier = computed(() =>
  props.champ.type === 'entier' ? { min: props.champ.min, max: props.champ.max } : null,
)

// Bornes de date, posées seulement après `onMounted` : les poser au rendu serveur les figerait à
// la date de build/ISR, potentiellement périmée au moment où la page est réellement servie.
const dateMin = ref<string | undefined>(undefined)
const dateMax = ref<string | undefined>(undefined)
onMounted(() => {
  if (props.champ.type !== 'date-future') return
  const aujourdhui = dateDuJourQuebec()
  dateMin.value = aujourdhui
  dateMax.value = ajouterJoursIso(aujourdhui, CONTACT_LIMITS.dateMaxJours)
})
</script>

<template>
  <FormField v-slot="{ componentField }" :name="nomChamp">
    <FormItem :class="champ.pleineLargeur ? 'lg:col-span-2' : undefined">
      <FormLabel class="font-display text-xs font-semibold uppercase tracking-widest text-navy">
        {{ champ.label }}
      </FormLabel>

      <!-- FormControl (Slot reka-ui) pose id / aria-invalid / aria-describedby sur son enfant
           direct : ce doit être le contrôle lui-même (select/input/textarea), jamais son enrobage
           visuel (icône), sinon le label ne désigne aucun contrôle. -->
      <div v-if="champ.type === 'select'" class="relative">
        <FormControl>
          <select
            :value="componentField.modelValue ?? ''"
            :name="componentField.name"
            class="h-12 w-full appearance-none rounded-xl border border-input bg-white px-4 pr-10 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm aria-invalid:border-destructive aria-invalid:ring-destructive/20"
            @change="componentField['onUpdate:modelValue']?.(($event.target as HTMLSelectElement).value)"
            @blur="componentField.onBlur"
          >
            <option value="" disabled>Sélectionnez une option</option>
            <option v-for="option in champ.options" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </FormControl>
        <ChevronDown
          :size="18"
          aria-hidden="true"
          class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink/70"
        />
      </div>

      <FormControl v-else>
        <Textarea
          v-if="champ.type === 'message'"
          v-bind="componentField"
          :rows="champ.lignes"
          :placeholder="champ.placeholder"
          :maxlength="CONTACT_LIMITS.messageMax"
          class="resize-none rounded-xl bg-white px-4 py-3"
        />
        <Input
          v-else
          v-bind="componentField"
          :type="typeInput"
          :inputmode="champ.type === 'telephone' ? 'tel' : champ.type === 'entier' ? 'numeric' : undefined"
          :autocomplete="autocompleteInput"
          :min="champ.type === 'date-future' ? dateMin : bornesEntier?.min"
          :max="champ.type === 'date-future' ? dateMax : bornesEntier?.max"
          :maxlength="maxLengthInput"
          :placeholder="champ.placeholder"
          :spellcheck="champ.type === 'email' ? false : undefined"
          class="h-12 rounded-xl bg-white px-4"
        />
      </FormControl>

      <FormMessage />
    </FormItem>
  </FormField>
</template>
