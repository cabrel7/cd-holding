<script setup lang="ts">
// États d'une liste serveur : chargement, erreur (+ Réessayer), vide, vide filtré (+ Réinitialiser),
// contenu. Le slot par défaut n'est rendu que dans l'état `ready`.
import { onScopeDispose, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { AdminListState } from '@/composables/useAdminPagedList'

const SKELETON_DELAY_MS = 150

const props = withDefaults(
  defineProps<{
    state: AdminListState
    messageVide: string
    messageVideFiltre?: string
    messageErreur?: string
    squelettes?: number
  }>(),
  {
    messageVideFiltre: 'Aucun résultat ne correspond à ces filtres.',
    messageErreur: undefined,
    squelettes: 3,
  },
)

const emit = defineEmits<{
  retry: []
  reset: []
}>()

// Squelette différé : un chargement plus court que le délai n'affiche pas de flash.
const showSkeleton = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

function clearTimer(): void {
  if (timer !== null) clearTimeout(timer)
  timer = null
}

watch(
  () => props.state === 'loading',
  (loading) => {
    clearTimer()
    showSkeleton.value = false
    if (loading) timer = setTimeout(() => (showSkeleton.value = true), SKELETON_DELAY_MS)
  },
  { immediate: true },
)

onScopeDispose(clearTimer)
</script>

<template>
  <div v-if="state === 'loading'" role="status" aria-live="polite" class="space-y-4">
    <span class="sr-only">Chargement…</span>
    <template v-if="showSkeleton">
      <div v-for="n in squelettes" :key="n" class="space-y-2 border-b border-border py-4">
        <Skeleton class="h-5 w-1/3" />
        <Skeleton class="h-4 w-2/3" />
        <Skeleton class="h-4 w-1/2" />
      </div>
    </template>
  </div>

  <div v-else-if="state === 'error'" role="alert" class="space-y-3 border-l-2 border-destructive py-2 pl-4">
    <p class="text-sm text-foreground">{{ messageErreur ?? 'Le chargement a échoué.' }}</p>
    <Button variant="outline" class="min-h-11 lg:min-h-9" @click="emit('retry')">Réessayer</Button>
  </div>

  <div v-else-if="state === 'filtered-empty'" class="flex flex-col items-center gap-3 py-8 text-center">
    <p class="text-sm text-foreground">{{ messageVideFiltre }}</p>
    <Button variant="outline" class="min-h-11 lg:min-h-9" @click="emit('reset')">Réinitialiser</Button>
  </div>

  <div v-else-if="state === 'empty'" class="flex flex-col items-center gap-3 py-8 text-center">
    <p class="text-sm text-foreground">{{ messageVide }}</p>
    <slot name="vide-action" />
  </div>

  <slot v-else />
</template>
