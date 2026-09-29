<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <div
    data-slot="sidebar-menu-badge"
    :class="cn(
      'bg-gold text-navy pointer-events-none absolute top-1/2 right-2 flex h-6 min-w-6 -translate-y-1/2 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums select-none',
      'group-data-[collapsible=icon]/sidebar:top-1 group-data-[collapsible=icon]/sidebar:right-1 group-data-[collapsible=icon]/sidebar:translate-y-0',
      props.class,
    )"
  >
    <slot />
  </div>
</template>
