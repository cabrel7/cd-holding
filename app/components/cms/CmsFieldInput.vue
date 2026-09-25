<script setup lang="ts">
// Rend un champ de formulaire CMS générique à partir d'une déclaration `CmsField` (catalogue
// des sections, réutilisé aussi par la config des collections — spec phase 2 §4.5/§4.6).
// `liste` sert deux usages du catalogue : un tableau répétable (ex. chiffres.items) quand la
// valeur est un tableau, ou un sous-objet fixe (ex. duo.a/b) sinon — déduit de la forme des
// données, un seul niveau d'imbrication (pas de `liste` dans un `liste`).
import { computed } from 'vue'
import { useField } from 'vee-validate'
import { ChevronDown, ChevronUp, Plus, Trash2 } from '@lucide/vue'
import type { CmsField } from '#shared/content/sections/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import CmsImageField from './CmsImageField.vue'

const props = defineProps<{
  field: CmsField
  name: string
  siteUuid: string
}>()

const { value, errorMessage, handleChange, handleBlur } = useField<unknown>(() => props.name)

const fieldId = computed(() => `cms-field-${props.name.replace(/[^a-zA-Z0-9]/g, '-')}`)

// --- paragraphes : un seul textarea, paragraphes séparés par une ligne vide ---
const paragraphesText = computed<string>({
  get: () => (Array.isArray(value.value) ? (value.value as string[]).join('\n\n') : ''),
  set: (text: string) => {
    handleChange(
      text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean),
    )
  },
})

// --- liste : tableau répétable ou sous-objet fixe, selon la forme de la valeur ---
const isRepeatable = computed(() => Array.isArray(value.value))
const listItems = computed(() => (Array.isArray(value.value) ? (value.value as Record<string, unknown>[]) : []))

function emptyItem(): Record<string, unknown> {
  const item: Record<string, unknown> = {}
  for (const f of props.field.itemFields ?? []) item[f.key] = f.type === 'switch' ? false : ''
  return item
}

function addItem(): void {
  handleChange([...listItems.value, emptyItem()])
}

function removeItem(index: number): void {
  const next = [...listItems.value]
  next.splice(index, 1)
  handleChange(next)
}

function moveItem(index: number, direction: -1 | 1): void {
  const next = [...listItems.value]
  const target = index + direction
  if (target < 0 || target >= next.length) return
  const current = next[index]
  const swapped = next[target]
  if (!current || !swapped) return
  next[index] = swapped
  next[target] = current
  handleChange(next)
}
</script>

<template>
  <div class="space-y-2">
    <Label v-if="field.type !== 'switch'" :for="fieldId">
      {{ field.label }}<span v-if="field.required" class="text-destructive"> *</span>
    </Label>

    <Input
      v-if="field.type === 'text'"
      :id="fieldId"
      :model-value="(value as string | number | undefined)"
      :maxlength="field.maxLength"
      :aria-invalid="!!errorMessage"
      @update:model-value="handleChange"
      @blur="handleBlur"
    />

    <Input
      v-else-if="field.type === 'url'"
      :id="fieldId"
      type="url"
      :model-value="(value as string | number | undefined)"
      :aria-invalid="!!errorMessage"
      @update:model-value="handleChange"
      @blur="handleBlur"
    />

    <Input
      v-else-if="field.type === 'date'"
      :id="fieldId"
      type="date"
      :model-value="(value as string | number | undefined)"
      :aria-invalid="!!errorMessage"
      @update:model-value="handleChange"
      @blur="handleBlur"
    />

    <Textarea
      v-else-if="field.type === 'textarea'"
      :id="fieldId"
      :model-value="(value as string | number | undefined)"
      :maxlength="field.maxLength"
      rows="5"
      :aria-invalid="!!errorMessage"
      @update:model-value="handleChange"
      @blur="handleBlur"
    />

    <Textarea
      v-else-if="field.type === 'paragraphes'"
      :id="fieldId"
      v-model="paragraphesText"
      rows="8"
      :aria-invalid="!!errorMessage"
      @blur="handleBlur"
    />

    <div v-else-if="field.type === 'switch'" class="flex items-center gap-2">
      <Switch :id="fieldId" :model-value="value === true" @update:model-value="handleChange" />
      <Label :for="fieldId">{{ field.label }}</Label>
    </div>

    <Select
      v-else-if="field.type === 'select'"
      :model-value="(value as string | undefined)"
      @update:model-value="handleChange"
    >
      <SelectTrigger :id="fieldId" class="w-full" :aria-invalid="!!errorMessage">
        <SelectValue :placeholder="field.label" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="opt in field.options ?? []" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </SelectItem>
      </SelectContent>
    </Select>

    <CmsImageField
      v-else-if="field.type === 'image'"
      :model-value="(value as string | null)"
      :site-uuid="siteUuid"
      @update:model-value="handleChange"
    />

    <div v-else-if="field.type === 'liste' && isRepeatable" class="space-y-3">
      <div v-for="(item, index) in listItems" :key="index" class="space-y-3 rounded-md border border-border p-3">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-muted-foreground">Élément {{ index + 1 }}</span>
          <div class="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              :disabled="index === 0"
              :aria-label="`Monter l'élément ${index + 1}`"
              @click="moveItem(index, -1)"
            >
              <ChevronUp class="size-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              :disabled="index === listItems.length - 1"
              :aria-label="`Descendre l'élément ${index + 1}`"
              @click="moveItem(index, 1)"
            >
              <ChevronDown class="size-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="text-destructive hover:bg-destructive/10 hover:text-destructive"
              :aria-label="`Retirer l'élément ${index + 1}`"
              @click="removeItem(index)"
            >
              <Trash2 class="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
        <CmsFieldInput
          v-for="sub in field.itemFields ?? []"
          :key="sub.key"
          :field="sub"
          :name="`${name}[${index}].${sub.key}`"
          :site-uuid="siteUuid"
        />
      </div>
      <Button type="button" variant="outline" size="sm" class="gap-1.5" @click="addItem">
        <Plus class="size-4" aria-hidden="true" /> Ajouter un élément
      </Button>
    </div>

    <div v-else-if="field.type === 'liste'" class="space-y-3 rounded-md border border-border p-3">
      <CmsFieldInput
        v-for="sub in field.itemFields ?? []"
        :key="sub.key"
        :field="sub"
        :name="`${name}.${sub.key}`"
        :site-uuid="siteUuid"
      />
    </div>

    <p v-if="field.helpText" class="text-xs text-muted-foreground">{{ field.helpText }}</p>
    <p v-if="errorMessage" class="text-sm text-destructive" role="alert">{{ errorMessage }}</p>
  </div>
</template>
