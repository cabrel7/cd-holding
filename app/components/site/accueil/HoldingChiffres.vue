<script setup lang="ts">
// Bandeau chiffres clés — fond navy, spec phase 3 §4.2. Les valeurs `effectif`/`filiales` sont
// déjà résolues côté serveur (`resolveChiffres`) : ce composant affiche `{valeur, libelle}` tel
// quel (ChiffresData). Vague du haut : une courbe unie (`fill-cream`), aucun dégradé.
import type { ChiffresData } from '@/composables/useSiteSections'
import SectionHeading from '@/components/site/SectionHeading.vue'

const props = defineProps<{ chiffres: ChiffresData }>()

const { reveal } = useReveal()

const heading = computed(() =>
  props.chiffres.titre ? { surtitre: props.chiffres.surtitre, titre: props.chiffres.titre, texte: props.chiffres.texte } : null,
)
</script>

<template>
  <section class="relative bg-navy py-24 text-cream md:py-32">
    <svg class="absolute -top-px left-0 w-full text-cream" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0,40 C240,0 480,80 720,60 C960,40 1200,0 1440,40 L1440,0 L0,0 Z" fill="currentColor" />
    </svg>

    <div class="relative mx-auto max-w-7xl px-6">
      <div class="grid grid-cols-1 gap-12 md:grid-cols-12">
        <div class="md:col-span-5 [&_em]:text-gold">
          <SectionHeading v-if="heading" :section="heading" tone="sombre" />
        </div>

        <div class="md:col-span-7">
          <dl class="grid grid-cols-2 gap-x-8 gap-y-14">
            <div
              v-for="(item, index) in chiffres.items"
              :key="item.libelle"
              v-motion
              v-bind="reveal(index)"
              class="flex flex-col-reverse border-t border-cream/20 pt-6"
            >
              <dt class="text-sm uppercase tracking-widest text-cream/90">{{ item.libelle }}</dt>
              <dd class="font-display text-5xl md:text-7xl">{{ item.valeur }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  </section>
</template>
