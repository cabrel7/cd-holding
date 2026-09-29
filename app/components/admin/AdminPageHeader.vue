<script setup lang="ts">
// En-tête de page admin : un seul h1, description courte, action primaire dans le slot.
defineProps<{
  titre: string
  description?: string
}>()
</script>

<template>
  <header class="flex flex-wrap items-end justify-between gap-4">
    <div class="min-w-0">
      <h1 class="font-display text-2xl font-semibold text-navy md:text-3xl">{{ titre }}</h1>
      <p v-if="description" class="mt-1 text-sm text-muted-foreground">{{ description }}</p>
    </div>
    <div v-if="$slots.default" class="flex shrink-0 items-center gap-2">
      <slot />
    </div>
  </header>
</template>
