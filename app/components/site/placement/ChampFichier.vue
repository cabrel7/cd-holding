<script setup lang="ts">
// Champ fichier accessible (candidature de placement, spec docs/specs/lot3-pages-specifiques.md
// §4) : input natif, liste des fichiers choisis avec bouton « Retirer » (cible ≥ 44 px, skill
// ui-ux règle 4), erreur sous le champ (jamais en toast, règle 7). N'utilise pas <FormField>
// (conçu pour une valeur scalaire) : une erreur sur un document précis a pour chemin
// `documents[i]`, qu'un <ErrorMessage name="documents"> ne verrait jamais — CandidatureForm
// agrège ces erreurs (préfixe du nom de champ) et les transmet via la prop `erreur`.
import { useId } from 'reka-ui'
import { useField } from 'vee-validate'
import { X } from '@lucide/vue'

const props = withDefaults(
  defineProps<{
    name: string
    label: string
    accept: string
    hint: string
    multiple?: boolean
    maxFichiers?: number
    /** Erreur agrégée par le formulaire parent (prioritaire sur l'erreur propre au champ). */
    erreur?: string | null
  }>(),
  { multiple: false, maxFichiers: 1, erreur: null },
)

const { value, setValue, errorMessage } = useField<File | File[] | undefined>(() => props.name)

// Dépassement de `maxFichiers` : message explicite plutôt qu'une troncature silencieuse.
const erreurLocale = ref<string | null>(null)
const messageErreur = computed(() => props.erreur ?? errorMessage.value ?? erreurLocale.value)

function commeFichiers(v: File | File[] | undefined): File[] {
  if (Array.isArray(v)) return v
  return v ? [v] : []
}

function onChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const choisis = Array.from(input.files ?? [])
  // Réinitialisé tout de suite : permet de rouvrir le sélecteur pour ajouter d'autres fichiers
  // (un <input type=file multiple> ne fusionne pas les sélections successives par lui-même).
  input.value = ''
  if (!choisis.length) return
  erreurLocale.value = null
  if (!props.multiple) {
    setValue(choisis[0])
    return
  }
  const fusion = [...commeFichiers(value.value), ...choisis]
  if (fusion.length > props.maxFichiers) {
    erreurLocale.value = `Vous pouvez joindre ${props.maxFichiers} documents au maximum : les fichiers en trop n’ont pas été ajoutés.`
  }
  setValue(fusion.slice(0, props.maxFichiers))
}

function retirer(index: number): void {
  erreurLocale.value = null
  if (props.multiple) {
    setValue(commeFichiers(value.value).filter((_, i) => i !== index))
  } else {
    setValue(undefined)
  }
}

const id = useId()
const erreurId = `${id}-erreur`
const aideId = `${id}-aide`
const decritPar = computed(() => (messageErreur.value ? `${aideId} ${erreurId}` : aideId))
</script>

<template>
  <div class="grid gap-2">
    <label :for="id" class="font-display text-xs font-semibold uppercase tracking-widest text-navy">
      {{ label }}
    </label>
    <input
      :id="id"
      type="file"
      :accept="accept"
      :multiple="multiple"
      :aria-invalid="!!messageErreur"
      :aria-describedby="decritPar"
      class="block w-full cursor-pointer text-sm text-ink/80 file:mr-4 file:cursor-pointer file:rounded-full file:border-0 file:bg-site-accent-strong file:h-11 file:px-5 file:text-sm file:font-semibold file:text-white"
      @change="onChange"
    >
    <p :id="aideId" class="text-xs text-ink/70">{{ hint }}</p>

    <ul v-if="commeFichiers(value).length" class="space-y-2">
      <li
        v-for="(fichier, index) in commeFichiers(value)"
        :key="`${fichier.name}-${index}`"
        class="flex items-center justify-between gap-3 rounded-lg bg-secondary px-3 py-2 text-sm text-ink/80"
      >
        <span class="truncate">{{ fichier.name }}</span>
        <button
          type="button"
          class="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-ink/60 transition-colors hover:text-destructive"
          :aria-label="`Retirer ${fichier.name}`"
          @click="retirer(index)"
        >
          <X :size="16" aria-hidden="true" />
        </button>
      </li>
    </ul>

    <p v-if="messageErreur" :id="erreurId" class="text-sm text-destructive" role="alert">{{ messageErreur }}</p>
  </div>
</template>
