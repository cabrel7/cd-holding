<script setup lang="ts">
// Pagination « 21–40 sur 57 » avec Précédent / Suivant (cibles >= 44 px en mobile).
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { Button } from '@/components/ui/button'

const props = defineProps<{
  page: number
  pageCount: number
  pageSize: number
  total: number
}>()

const emit = defineEmits<{ 'update:page': [page: number] }>()

const debut = computed(() => (props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1))
const fin = computed(() => Math.min(props.page * props.pageSize, props.total))
</script>

<template>
  <nav aria-label="Pagination" class="flex flex-wrap items-center justify-between gap-3 pt-4">
    <p role="status" aria-live="polite" class="text-sm text-muted-foreground">
      <template v-if="total > 0">{{ debut }}–{{ fin }} sur {{ total }}</template>
    </p>
    <div v-if="pageCount > 1" class="flex items-center gap-2">
      <Button variant="outline" class="min-h-11 lg:min-h-9" :disabled="page <= 1" @click="emit('update:page', page - 1)">
        <ChevronLeft aria-hidden="true" />
        Précédent
      </Button>
      <span class="text-sm text-muted-foreground">Page {{ page }} / {{ pageCount }}</span>
      <Button variant="outline" class="min-h-11 lg:min-h-9" :disabled="page >= pageCount" @click="emit('update:page', page + 1)">
        Suivant
        <ChevronRight aria-hidden="true" />
      </Button>
    </div>
  </nav>
</template>
