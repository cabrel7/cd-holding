<script setup lang="ts">
import type { Component, HTMLAttributes } from "vue"
import type { PrimitiveProps } from "reka-ui"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import SidebarMenuButtonChild from "./SidebarMenuButtonChild.vue"
import { useSidebar } from "./utils"

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<PrimitiveProps & {
  isActive?: boolean
  /** Libellé affiché en infobulle quand la barre est repliée en rail d'icônes. */
  tooltip?: string | Component
  class?: HTMLAttributes["class"]
}>(), {
  as: "button",
  isActive: false,
})

const { isMobile, state } = useSidebar()
</script>

<template>
  <SidebarMenuButtonChild
    v-if="!tooltip"
    v-bind="{ ...$attrs, ...props }"
  >
    <slot />
  </SidebarMenuButtonChild>

  <Tooltip v-else>
    <TooltipTrigger as-child>
      <SidebarMenuButtonChild v-bind="{ ...$attrs, ...props }">
        <slot />
      </SidebarMenuButtonChild>
    </TooltipTrigger>
    <TooltipContent
      side="right"
      align="center"
      :hidden="state !== 'collapsed' || isMobile"
    >
      <template v-if="typeof tooltip === 'string'">
        {{ tooltip }}
      </template>
      <component :is="tooltip" v-else />
    </TooltipContent>
  </Tooltip>
</template>
