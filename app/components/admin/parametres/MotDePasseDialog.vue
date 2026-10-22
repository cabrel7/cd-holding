<script setup lang="ts">
// Dialog « Changer le mot de passe » (spec lot 5 §5). VeeValidate + `toTypedSchema` de la fabrique
// `changementMotDePasseDialogSchema()` : source unique des règles (longueur, nouveau ≠ actuel,
// confirmation). Fermé seulement après succès (la page garde `open`), valeurs vidées à la fermeture.
// L'erreur 400 du serveur s'affiche sous le champ « Mot de passe actuel », jamais en toast.
import { nextTick, ref, watch } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { Eye, EyeOff } from '@lucide/vue'
import { changementMotDePasseDialogSchema } from '#shared/validation/auth'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { MotDePasseValeurs } from './useMotDePasseAction'

const props = defineProps<{
  open: boolean
  submitting: boolean
  /** Message 400 du serveur à afficher sous le champ « Mot de passe actuel ». */
  actuelError?: string | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: [valeurs: MotDePasseValeurs]
}>()

const { handleSubmit, errors, defineField, resetForm, setFieldError } = useForm({
  validationSchema: toTypedSchema(changementMotDePasseDialogSchema()),
  initialValues: { actuel: '', nouveau: '', confirmation: '' },
})

const [actuel, actuelAttrs] = defineField('actuel')
const [nouveau, nouveauAttrs] = defineField('nouveau')
const [confirmation, confirmationAttrs] = defineField('confirmation')

type ChampMotDePasse = 'actuel' | 'nouveau' | 'confirmation'

// Bascule afficher/masquer indépendante par champ (spec §5).
const affiches = ref<Record<ChampMotDePasse, boolean>>({ actuel: false, nouveau: false, confirmation: false })

// Conteneur du champ « actuel » : le focus y est renvoyé après un 400 serveur (miroir
// CmsFormDialog — `<Input>` n'expose pas `focus()`, d'où le querySelector).
const zoneActuel = ref<HTMLElement | null>(null)

function basculer(champ: ChampMotDePasse): void {
  affiches.value[champ] = !affiches.value[champ]
}

const VALEURS_VIDES = { actuel: '', nouveau: '', confirmation: '' } as const satisfies MotDePasseValeurs

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) return
    resetForm({ values: { ...VALEURS_VIDES } })
    affiches.value = { actuel: false, nouveau: false, confirmation: false }
  },
)

// 400 serveur (« Mot de passe actuel incorrect ») : sous le champ, comme une erreur client,
// avec renvoi du focus sur le champ fautif (l'utilisateur ne doit pas le rechercher à la main).
watch(
  () => props.actuelError,
  async (message) => {
    if (!message) return
    setFieldError('actuel', message)
    await nextTick()
    zoneActuel.value?.querySelector<HTMLElement>('input')?.focus()
  },
)

const onSubmit = handleSubmit((valeurs) => {
  emit('submit', { actuel: valeurs.actuel, nouveau: valeurs.nouveau, confirmation: valeurs.confirmation })
})

function onOpenChange(value: boolean): void {
  if (!value && props.submitting) return
  emit('update:open', value)
}
</script>

<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Changer le mot de passe</DialogTitle>
        <DialogDescription>Saisissez votre mot de passe actuel pour confirmer le changement.</DialogDescription>
      </DialogHeader>

      <form class="space-y-4" novalidate @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label for="mdp-actuel">Mot de passe actuel</Label>
          <div ref="zoneActuel" class="relative">
            <Input
              id="mdp-actuel"
              v-model="actuel"
              v-bind="actuelAttrs"
              :type="affiches.actuel ? 'text' : 'password'"
              autocomplete="current-password"
              class="h-11 pr-12 md:h-10"
              :aria-invalid="!!errors.actuel"
              :aria-describedby="errors.actuel ? 'mdp-actuel-err' : undefined"
            />
            <button
              type="button"
              class="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition-colors outline-hidden hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              :aria-label="affiches.actuel ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
              @click="basculer('actuel')"
            >
              <EyeOff v-if="affiches.actuel" class="size-4" aria-hidden="true" />
              <Eye v-else class="size-4" aria-hidden="true" />
            </button>
          </div>
          <p v-if="errors.actuel" id="mdp-actuel-err" class="text-sm text-destructive" role="alert">{{ errors.actuel }}</p>
        </div>

        <div class="space-y-2">
          <Label for="mdp-nouveau">Nouveau mot de passe</Label>
          <div class="relative">
            <Input
              id="mdp-nouveau"
              v-model="nouveau"
              v-bind="nouveauAttrs"
              :type="affiches.nouveau ? 'text' : 'password'"
              autocomplete="new-password"
              class="h-11 pr-12 md:h-10"
              :aria-invalid="!!errors.nouveau"
              :aria-describedby="errors.nouveau ? 'mdp-nouveau-err' : undefined"
            />
            <button
              type="button"
              class="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition-colors outline-hidden hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              :aria-label="affiches.nouveau ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
              @click="basculer('nouveau')"
            >
              <EyeOff v-if="affiches.nouveau" class="size-4" aria-hidden="true" />
              <Eye v-else class="size-4" aria-hidden="true" />
            </button>
          </div>
          <p v-if="errors.nouveau" id="mdp-nouveau-err" class="text-sm text-destructive" role="alert">{{ errors.nouveau }}</p>
        </div>

        <div class="space-y-2">
          <Label for="mdp-confirmation">Confirmer le nouveau mot de passe</Label>
          <div class="relative">
            <Input
              id="mdp-confirmation"
              v-model="confirmation"
              v-bind="confirmationAttrs"
              :type="affiches.confirmation ? 'text' : 'password'"
              autocomplete="new-password"
              class="h-11 pr-12 md:h-10"
              :aria-invalid="!!errors.confirmation"
              :aria-describedby="errors.confirmation ? 'mdp-confirmation-err' : undefined"
            />
            <button
              type="button"
              class="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition-colors outline-hidden hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              :aria-label="affiches.confirmation ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
              @click="basculer('confirmation')"
            >
              <EyeOff v-if="affiches.confirmation" class="size-4" aria-hidden="true" />
              <Eye v-else class="size-4" aria-hidden="true" />
            </button>
          </div>
          <p v-if="errors.confirmation" id="mdp-confirmation-err" class="text-sm text-destructive" role="alert">{{ errors.confirmation }}</p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" class="min-h-11 md:min-h-9" :disabled="submitting" @click="onOpenChange(false)">
            Annuler
          </Button>
          <Button type="submit" class="min-h-11 md:min-h-9" :disabled="submitting" :aria-busy="submitting">
            {{ submitting ? 'Enregistrement…' : 'Enregistrer' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
