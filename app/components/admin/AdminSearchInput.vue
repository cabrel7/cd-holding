<script setup lang="ts">
// Champ de recherche avec label réel (jamais placeholder seul).
import { useId } from 'vue'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ADMIN_SEARCH_MAX } from '#shared/config/admin'

defineProps<{ label: string }>()
const model = defineModel<string>({ required: true })
const id = useId()
</script>

<template>
  <div class="space-y-1.5">
    <Label :for="id" class="text-xs text-muted-foreground">{{ label }}</Label>
    <Input :id="id" v-model="model" type="search" :maxlength="ADMIN_SEARCH_MAX" autocomplete="off" class="h-11 md:h-9 md:w-64" />
  </div>
</template>
