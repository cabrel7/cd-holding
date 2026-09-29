<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useSidebar } from "./utils"

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  /** "icon" : replié en rail d'icônes sur desktop. "none" : jamais replié. */
  collapsible?: "icon" | "none"
  /** Titre lu par les lecteurs d'écran pour le Sheet mobile. */
  mobileTitle?: string
  class?: HTMLAttributes["class"]
}>(), {
  collapsible: "icon",
  mobileTitle: "Menu de navigation",
})

const { isMobile, state, openMobile, setOpenMobile } = useSidebar()
</script>

<template>
  <Sheet v-if="isMobile" :open="openMobile" @update:open="setOpenMobile">
    <SheetContent
      data-sidebar="sidebar"
      data-mobile="true"
      side="left"
      close-label="Fermer le menu"
      class="bg-card text-foreground w-72 gap-0 p-0 sm:max-w-72"
    >
      <SheetHeader class="sr-only">
        <SheetTitle>{{ mobileTitle }}</SheetTitle>
        <SheetDescription>Navigation de la console d'administration.</SheetDescription>
      </SheetHeader>
      <div class="flex h-full w-full flex-col">
        <slot />
      </div>
    </SheetContent>
  </Sheet>

  <aside
    v-else
    data-slot="sidebar"
    data-sidebar="sidebar"
    :data-state="state"
    :data-collapsible="state === 'collapsed' ? collapsible : ''"
    :class="cn(
      'group/sidebar bg-card text-foreground border-border sticky top-0 hidden h-svh shrink-0 flex-col border-r transition-[width] duration-200 ease-out motion-reduce:transition-none lg:flex',
      state === 'collapsed' && collapsible === 'icon' ? 'w-16' : 'w-64',
      props.class,
    )"
    v-bind="$attrs"
  >
    <slot />
  </aside>
</template>
