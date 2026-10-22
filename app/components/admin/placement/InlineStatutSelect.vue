<script setup lang="ts">
// Sélecteur de statut en ligne (PATCH rapide). Le label est visuellement masqué : le statut est
// déjà porté par le Badge voisin, et en tableau un label visible par ligne serait répétitif.
import { useId } from 'vue'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

withDefaults(
  defineProps<{
    modelValue: string
    label: string
    options: readonly { readonly value: string; readonly label: string }[]
    busy?: boolean
  }>(),
  { busy: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const id = useId()
</script>

<template>
  <div class="space-y-1.5">
    <Label :for="id" class="sr-only">{{ label }}</Label>
    <Select :model-value="modelValue" :disabled="busy" @update:model-value="(v) => emit('update:modelValue', String(v))">
      <SelectTrigger :id="id" class="w-full data-[size=default]:h-11 md:w-40 md:data-[size=default]:h-9">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</SelectItem>
      </SelectContent>
    </Select>
  </div>
</template>
