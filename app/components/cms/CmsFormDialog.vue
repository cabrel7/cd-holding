<script setup lang="ts">
// Dialog générique de création/édition CMS (collections ET sections, spec phase 2 §4.5).
// VeeValidate gère l'état du formulaire ; la validation finale passe par le schéma zod partagé
// (`schema.safeParse`) au submit — évite de recréer un typage vee-validate profondément
// imbriqué pour les champs `liste`/`paragraphes` (un seul niveau, transformé ici). Les erreurs
// vont sous le champ concerné (`setErrors`), jamais en toast (voir CLAUDE.md, ui-ux §7).
import { watch } from 'vue'
import { useForm } from 'vee-validate'
import type { ZodType } from 'zod'
import type { CmsField } from '#shared/content/sections/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import CmsFieldInput from './CmsFieldInput.vue'

const props = defineProps<{
  open: boolean
  titre: string
  description?: string
  fields: readonly CmsField[]
  schema: ZodType
  initialValues: Record<string, unknown>
  siteUuid: string
  submitting: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: [values: Record<string, unknown>]
}>()

/** Transforme récursivement (un seul niveau de `liste`) entre la forme "formulaire" (texte
 * joint pour `paragraphes`) et la forme "domaine" (tableau) attendue par le schéma zod. */
function transformValues(
  fields: readonly CmsField[],
  input: Record<string, unknown>,
  direction: 'toDisplay' | 'toSubmit',
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...input }
  for (const field of fields) {
    const current = out[field.key]

    if (field.type === 'paragraphes') {
      if (direction === 'toDisplay' && Array.isArray(current)) {
        out[field.key] = (current as string[]).join('\n\n')
      } else if (direction === 'toSubmit' && typeof current === 'string') {
        out[field.key] = current
          .split(/\n\s*\n/)
          .map((p) => p.trim())
          .filter(Boolean)
      }
      continue
    }

    if (field.type === 'liste' && field.itemFields) {
      const itemFields = field.itemFields
      if (Array.isArray(current)) {
        out[field.key] = (current as Record<string, unknown>[]).map((item) => transformValues(itemFields, item, direction))
      } else if (current && typeof current === 'object') {
        out[field.key] = transformValues(itemFields, current as Record<string, unknown>, direction)
      }
    }
  }
  return out
}

const { handleSubmit, resetForm, setErrors } = useForm<Record<string, unknown>>({
  initialValues: transformValues(props.fields, props.initialValues, 'toDisplay'),
})

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      resetForm({ values: transformValues(props.fields, props.initialValues, 'toDisplay') })
    }
  },
)

const onSubmit = handleSubmit((formValues) => {
  const payload = transformValues(props.fields, formValues, 'toSubmit')
  const parsed = props.schema.safeParse(payload)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const path = issue.path.join('.')
      if (path && !(path in fieldErrors)) fieldErrors[path] = issue.message
    }
    setErrors(fieldErrors)
    return
  }
  emit('submit', parsed.data as Record<string, unknown>)
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

      <form class="space-y-4" @submit="onSubmit">
        <CmsFieldInput v-for="field in fields" :key="field.key" :field="field" :name="field.key" :site-uuid="siteUuid" />

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="submitting" @click="onOpenChange(false)">Annuler</Button>
          <Button type="submit" :disabled="submitting">
            {{ submitting ? 'Enregistrement…' : 'Enregistrer' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
