<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { useMediaQuery } from "@vueuse/core"
import { computed, ref } from "vue"
import { cn } from "@/lib/utils"
import { TooltipProvider } from "@/components/ui/tooltip"
import { provideSidebarContext, SIDEBAR_MOBILE_QUERY } from "./utils"

const props = withDefaults(defineProps<{
  defaultOpen?: boolean
  class?: HTMLAttributes["class"]
}>(), {
  defaultOpen: true,
})

const isMobile = useMediaQuery(SIDEBAR_MOBILE_QUERY)
const openMobile = ref(false)
const open = ref(props.defaultOpen)

function setOpen(value: boolean) {
  open.value = value
}

function setOpenMobile(value: boolean) {
  openMobile.value = value
}

function toggleSidebar() {
  if (isMobile.value) {
    setOpenMobile(!openMobile.value)
  }
  else {
    setOpen(!open.value)
  }
}

const state = computed<"expanded" | "collapsed">(() => (open.value ? "expanded" : "collapsed"))

provideSidebarContext({
  state,
  open,
  setOpen,
  isMobile,
  openMobile,
  setOpenMobile,
  toggleSidebar,
})
</script>

<template>
  <TooltipProvider :delay-duration="0">
    <div data-slot="sidebar-wrapper" :class="cn('flex min-h-svh w-full', props.class)">
      <slot />
    </div>
  </TooltipProvider>
</template>
