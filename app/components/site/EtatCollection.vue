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
    emptyMessage?: string
    tone?: 'clair' | 'sombre'
    /** `lignes` : squelette de 3 lignes (liste), `grille` : 3 vignettes (équipe, partenaires). */
    variant?: 'grille' | 'lignes'
  }>(),
  { tone: 'clair', variant: 'grille' },
)

const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div v-if="pending && variant === 'lignes'" class="space-y-4" aria-hidden="true">
    <div v-for="n in 3" :key="n" class="h-24 animate-pulse rounded-xl bg-secondary" />
  </div>
  <div v-else-if="pending" class="grid grid-cols-1 gap-10 md:grid-cols-3" aria-hidden="true">
    <div v-for="n in 3" :key="n" class="animate-pulse">
      <div class="aspect-[4/5] w-full rounded-3xl" :class="tone === 'sombre' ? 'bg-cream/10' : 'bg-secondary'" />
    </div>
  </div>
  <div v-else-if="error" role="alert" class="flex flex-col items-start gap-3">
    <p :class="tone === 'sombre' ? 'text-cream/70' : 'text-ink/70'">Impossible de charger ce contenu pour le moment.</p>
    <Button variant="outline" class="min-h-11" @click="emit('retry')">Réessayer</Button>
  </div>
  <p v-else-if="empty" :class="tone === 'sombre' ? 'text-cream/70' : 'text-ink/70'">{{ emptyMessage }}</p>
  <!-- Élément racine aussi dans l'état « succès » : sans lui, les classes passées par le parent
       (espacement, ex. `mt-20`) seraient perdues, un slot n'ayant pas d'élément où les poser. -->
  <div v-else><slot /></div>
</template>
