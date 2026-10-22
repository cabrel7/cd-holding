<script setup lang="ts">
// Dialog de création/édition d'un quart. Dialog dédié (pas `CmsFormDialog`) : le formulaire
// combine une date + deux heures natives (`time`, non portés par `CmsField`/`CmsFieldInput`) en
// datetimes ISO via `instantQuebec`. La validation finale du fond (employé actif du site, lieu,
// ISO) reste côté serveur (`quartCreateSchema`/`quartUpdateSchema`) — ce schéma local n'est
// qu'un miroir de saisie. Piloté par `PlanningView` : fermé seulement après succès.
import { computed, watch, type Ref } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import { instantQuebec, isDateCalendaireValide } from '#shared/utils/dates'
import type { AdminEmployePlanningDto } from '#shared/types/admin'
import type { QuartCreateInput } from '#shared/validation/planning'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

/** Valeurs de saisie (chaînes brutes) calculées par `PlanningView` (pré-remplissage jour/quart). */
export interface QuartFormValeurs {
  readonly employeUuid: string
  /** Jour du quart (YYYY-MM-DD). */
  readonly date: string
  readonly heureDebut: string
  readonly heureFin: string
  readonly lieu: string
  readonly titre: string
  readonly notes: string
}

const HEURE_MESSAGE = 'Heure invalide (HH:mm).'
const HEURE_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

const quartFormSchema = z
  .object({
    employeUuid: z.string().uuid('Choisissez un employé.'),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choisissez une date.')
      .refine(isDateCalendaireValide, 'Choisissez une date valide.'),
    heureDebut: z.string().regex(HEURE_PATTERN, HEURE_MESSAGE),
    heureFin: z.string().regex(HEURE_PATTERN, HEURE_MESSAGE),
    lieu: z.string().trim().min(1, 'Ce champ est requis.').max(160, '160 caractères au maximum.'),
    titre: z.preprocess(
      (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v),
      z.string().trim().max(120, '120 caractères au maximum.').nullable().optional(),
    ),
    notes: z.preprocess(
      (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v),
      z.string().trim().max(2000, '2000 caractères au maximum.').nullable().optional(),
    ),
  })
  .strict()

const props = defineProps<{
  open: boolean
  titre: string
  description?: string
  employes: readonly AdminEmployePlanningDto[]
  valeurs: QuartFormValeurs
  submitting: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: [payload: QuartCreateInput]
}>()

const { handleSubmit, errors, defineField, resetForm } = useForm({
  validationSchema: toTypedSchema(quartFormSchema),
  initialValues: { ...props.valeurs },
})

const [employeUuid] = defineField('employeUuid')
const [date, dateAttrs] = defineField('date')
const [heureDebut, heureDebutAttrs] = defineField('heureDebut')
const [heureFin, heureFinAttrs] = defineField('heureFin')
const [lieu, lieuAttrs] = defineField('lieu')
// Champs optionnels : le z.preprocess donne un type `unknown` côté VeeValidate (l'.optional()
// transforme le type) — on type le bind explicitement (initialValues = strings). Les refs de
// champ sont suffixées `Field` : le prop `titre` (titre du dialog) doit rester visible.
const [titreField, titreAttrs] = defineField('titre') as unknown as [Ref<string>, Record<string, unknown>]
const [notesField, notesAttrs] = defineField('notes') as unknown as [Ref<string>, Record<string, unknown>]

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) resetForm({ values: { ...props.valeurs } })
  },
)

/** Employés proposés : les actifs, plus l'employé du quart en cours d'édition s'il est inactif
 * (ses quarts existants restent éditables — spec §1). */
const optionsEmployes = computed(() =>
  props.employes
    .filter((e) => e.actif || e.uuid === props.valeurs.employeUuid)
    .map((e) => ({ value: e.uuid, label: e.actif ? `${e.nom} — ${e.poste}` : `${e.nom} — ${e.poste} (inactif)` })),
)

const onSubmit = handleSubmit((v) => {
  emit('submit', {
    employeUuid: v.employeUuid,
    dateDebut: instantQuebec(v.date, v.heureDebut).toISOString(),
    dateFin: instantQuebec(v.date, v.heureFin).toISOString(),
    lieu: v.lieu,
    // Le schéma convertit '' → null : un champ vidé ÉMET null → l'ancien titre/notes est effacé
    // (absent = non touché). Jamais `v.titre ?` qui masquerait le null.
    ...(v.titre !== undefined ? { titre: v.titre } : {}),
    ...(v.notes !== undefined ? { notes: v.notes } : {}),
  })
})

function onOpenChange(value: boolean): void {
  emit('update:open', value)
}
</script>

<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ titre }}</DialogTitle>
        <DialogDescription v-if="description">{{ description }}</DialogDescription>
      </DialogHeader>

      <form class="space-y-4" novalidate @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label for="quart-employe">Employé *</Label>
          <Select :model-value="employeUuid" @update:model-value="(v) => (employeUuid = String(v))">
            <SelectTrigger id="quart-employe" class="w-full" :aria-invalid="!!errors.employeUuid">
              <SelectValue placeholder="Choisissez un employé" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="opt in optionsEmployes" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
          <p v-if="errors.employeUuid" class="text-sm text-destructive" role="alert">{{ errors.employeUuid }}</p>
        </div>

        <div class="grid gap-4 sm:grid-cols-3">
          <div class="space-y-2">
            <Label for="quart-date">Date *</Label>
            <Input
              id="quart-date"
              v-model="date"
              v-bind="dateAttrs"
              type="date"
              class="h-11 md:h-10"
              :aria-invalid="!!errors.date"
            />
            <p v-if="errors.date" class="text-sm text-destructive" role="alert">{{ errors.date }}</p>
          </div>
          <div class="space-y-2">
            <Label for="quart-debut">Début *</Label>
            <Input
              id="quart-debut"
              v-model="heureDebut"
              v-bind="heureDebutAttrs"
              type="time"
              class="h-11 md:h-10"
              :aria-invalid="!!errors.heureDebut"
            />
            <p v-if="errors.heureDebut" class="text-sm text-destructive" role="alert">{{ errors.heureDebut }}</p>
          </div>
          <div class="space-y-2">
            <Label for="quart-fin">Fin *</Label>
            <Input
              id="quart-fin"
              v-model="heureFin"
              v-bind="heureFinAttrs"
              type="time"
              class="h-11 md:h-10"
              :aria-invalid="!!errors.heureFin"
            />
            <p v-if="errors.heureFin" class="text-sm text-destructive" role="alert">{{ errors.heureFin }}</p>
          </div>
        </div>

        <div class="space-y-2">
          <Label for="quart-lieu">Lieu *</Label>
          <Input
            id="quart-lieu"
            v-model="lieu"
            v-bind="lieuAttrs"
            type="text"
            maxlength="160"
            autocomplete="off"
            class="h-11 md:h-10"
            :aria-invalid="!!errors.lieu"
          />
          <p v-if="errors.lieu" class="text-sm text-destructive" role="alert">{{ errors.lieu }}</p>
        </div>

        <div class="space-y-2">
          <Label for="quart-titre">Titre (facultatif)</Label>
          <Input
            id="quart-titre"
            v-model="titreField"
            v-bind="titreAttrs"
            type="text"
            maxlength="120"
            autocomplete="off"
            class="h-11 md:h-10"
            :aria-invalid="!!errors.titre"
          />
          <p v-if="errors.titre" class="text-sm text-destructive" role="alert">{{ errors.titre }}</p>
        </div>

        <div class="space-y-2">
          <Label for="quart-notes">Notes (facultatif)</Label>
          <Textarea id="quart-notes" v-model="notesField" v-bind="notesAttrs" rows="3" maxlength="2000" :aria-invalid="!!errors.notes" />
          <p v-if="errors.notes" class="text-sm text-destructive" role="alert">{{ errors.notes }}</p>
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
