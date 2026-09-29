<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <div data-slot="sidebar-group-label" :class="cn('text-muted-foreground flex h-8 shrink-0 items-center px-2 text-xs font-medium uppercase tracking-wider transition-opacity duration-200 group-data-[collapsible=icon]/sidebar:sr-only', props.class)">
    <slot />
  </div>
</template>
