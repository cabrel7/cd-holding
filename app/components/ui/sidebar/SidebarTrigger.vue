<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { PanelLeft } from "@lucide/vue"
import { computed } from "vue"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useSidebar } from "./utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()

const { toggleSidebar, isMobile, open, openMobile } = useSidebar()

const expanded = computed(() => (isMobile.value ? openMobile.value : open.value))
const label = computed(() => (expanded.value ? "Réduire le menu" : "Ouvrir le menu"))
</script>

<template>
  <Button
    data-slot="sidebar-trigger"
    variant="ghost"
    size="icon"
    :class="cn('size-11', props.class)"
    :aria-label="label"
    :aria-expanded="expanded"
    @click="toggleSidebar"
  >
    <PanelLeft aria-hidden="true" />
  </Button>
</template>
