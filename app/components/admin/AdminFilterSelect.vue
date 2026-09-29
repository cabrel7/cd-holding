<script setup lang="ts">
// Filtre à liste fermée avec option « Tous » (reka Select interdit la valeur vide : sentinelle).
import { useId } from 'vue'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

defineProps<{
  label: string
  toutLabel: string
  options: readonly { readonly value: string; readonly label: string }[]
}>()

const model = defineModel<string | undefined>({ required: true })

const TOUT = '__tout__'
const id = useId()
</script>

<template>
  <div class="space-y-1.5">
    <Label :for="id" class="text-xs text-muted-foreground">{{ label }}</Label>
    <Select :model-value="model ?? TOUT" @update:model-value="(v) => (model = v === TOUT ? undefined : String(v))">
      <SelectTrigger :id="id" class="w-full data-[size=default]:h-11 md:data-[size=default]:h-9 md:w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem :value="TOUT">{{ toutLabel }}</SelectItem>
        <SelectItem v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</SelectItem>
      </SelectContent>
    </Select>
  </div>
</template>
