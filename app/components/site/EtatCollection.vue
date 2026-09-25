<script setup lang="ts">
// États obligatoires (pending/error/empty/success) pour une collection publique affichée sur
// une page marketing (équipe, partenaires...) — skill ui-ux §2. Composant partagé pour éviter
// de dupliquer ces quatre branches sur chaque page `a-propos` (holding et filiale).
import { Button } from '@/components/ui/button'

withDefaults(
  defineProps<{
    pending: boolean
    error: boolean
    empty: boolean
    emptyMessage: string
    tone?: 'clair' | 'sombre'
  }>(),
  { tone: 'clair' },
)

const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div v-if="pending" class="grid grid-cols-1 gap-10 md:grid-cols-3" aria-hidden="true">
    <div v-for="n in 3" :key="n" class="animate-pulse">
      <div class="aspect-[4/5] w-full rounded-3xl" :class="tone === 'sombre' ? 'bg-cream/10' : 'bg-secondary'" />
    </div>
  </div>
  <div v-else-if="error" class="flex flex-col items-start gap-3">
    <p :class="tone === 'sombre' ? 'text-cream/70' : 'text-ink/70'">Impossible de charger ce contenu pour le moment.</p>
    <Button variant="outline" size="sm" @click="emit('retry')">Réessayer</Button>
  </div>
  <p v-else-if="empty" :class="tone === 'sombre' ? 'text-cream/70' : 'text-ink/70'">{{ emptyMessage }}</p>
  <slot v-else />
</template>
