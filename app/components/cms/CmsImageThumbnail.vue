<script setup lang="ts">
// Miniature d'une fiche CMS (service, réalisation, membre, partenaire). Composant local et
// autonome (pas de dépendance vers app/components/site/**, hors périmètre T4) : le rendu se
// limite à /api/files/[key] (route publique déjà en place côté serveur) avec un repli neutre.
import { ImageOff } from '@lucide/vue'

defineProps<{
  imageKey: string | null
  alt: string
}>()
</script>

<template>
  <img
    v-if="imageKey"
    :src="`/api/files/${imageKey}`"
    :alt="alt"
    class="h-12 w-12 shrink-0 rounded-md border border-border object-cover"
  >
  <div
    v-else
    class="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground"
    aria-hidden="true"
  >
    <ImageOff class="size-4" />
  </div>
</template>
