<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { Primitive } from "reka-ui"
import { cn } from "@/lib/utils"

const props = withDefaults(defineProps<PrimitiveProps & {
  isActive?: boolean
  class?: HTMLAttributes["class"]
}>(), {
  as: "button",
  isActive: false,
})
</script>

<template>
  <Primitive
    data-slot="sidebar-menu-button"
    data-sidebar="menu-button"
    :data-active="props.isActive"
    :as="as"
    :as-child="asChild"
    :class="cn(
      'flex h-11 w-full items-center gap-3 overflow-hidden rounded-md px-3 text-left text-sm font-medium outline-hidden transition-colors',
      'hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:ring-2',
      'data-[active=true]:bg-primary data-[active=true]:text-primary-foreground',
      'disabled:pointer-events-none disabled:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0 [&>span:last-child]:truncate',
      'group-data-[collapsible=icon]/sidebar:justify-center group-data-[collapsible=icon]/sidebar:px-0 group-data-[collapsible=icon]/sidebar:[&>span:last-child]:sr-only',
      props.class,
    )"
  >
    <slot />
  </Primitive>
</template>
