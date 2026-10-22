<script setup lang="ts">
// Champ de recherche avec label réel (jamais placeholder seul).
import { useId } from 'vue'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ADMIN_SEARCH_MAX } from '#shared/config/admin'

defineProps<{ label: string; placeholder?: string }>()
const model = defineModel<string>({ required: true })
const id = useId()
</script>

<template>
  <div class="w-full space-y-1.5 md:w-auto">
    <Label :for="id" class="text-xs text-muted-foreground">{{ label }}</Label>
    <Input :id="id" v-model="model" type="search" :placeholder="placeholder" :maxlength="ADMIN_SEARCH_MAX" autocomplete="off" class="h-11 w-full md:h-9 md:w-64" />
  </div>
</template>
