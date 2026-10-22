<script setup lang="ts">
// Contact — filiales (spec docs/specs/lot2-contact-filiales.md §4, prototype SubContactPage.tsx).
// Même charpente que /contact (holding, ContactIntro réutilisé tel quel) mais la carte formulaire
// est entièrement pilotée par CONTACT_FORMS[slug] (FilialeContactForm) — aucun `if (slug === …)`
// ici. Suggestion de produit (cdpaa, boissons) affichée seulement si la section éditable existe.
import { isFilialeSlug } from '#shared/config/sites'
import { estFormulaireFiliale, estSiteSuggestion, FORMULAIRES_FILIALES, type FormulaireFilialeSlug, type SiteSuggestion } from '#shared/config/contact-forms'
import { interpoler } from '#shared/utils/texte'
import type { FormulaireData, SeoData } from '@/composables/useSiteSections'
import ContactIntro from '@/components/site/contact/ContactIntro.vue'
import FilialeContactForm from '@/components/site/contact/FilialeContactForm.vue'
import SuggestionProduitForm from '@/components/site/contact/SuggestionProduitForm.vue'
import { Button } from '@/components/ui/button'

definePageMeta({
  // Gate du mode chemin (spec lot 8, D4) : paramètre de route (forme préfixée) ou slug résolu
  // de l'hôte (forme nue sur un sous-domaine filiale). Un paramètre présent mais invalide reste
  // un 404 — on ne retombe jamais sur l'hôte.
  validate: (route) => {
    const param = route.params.filiale
    if (typeof param === 'string') return isFilialeSlug(param)
    const hote = useSiteHost().value.slug
    return hote !== undefined && isFilialeSlug(hote)
  },
})

// `useCurrentSiteSlug` renvoie `SiteSlug` (holding compris) : narrowé ici vers les 6 filiales à
// formulaire. Le repli n'est jamais atteint en pratique — `definePageMeta.validate` (paramètre ou
// hôte) bloque toute autre valeur avant que ce composant ne se monte. Le dispatcher racine rend
// aussi ce composant sans paramètre de route, d'où la résolution par l'hôte.
const slugBrut = useCurrentSiteSlug()
const slug = computed<FormulaireFilialeSlug>(() =>
  estFormulaireFiliale(slugBrut.value) ? slugBrut.value : FORMULAIRES_FILIALES[0],
)
const siteSuggestion = computed<SiteSuggestion | null>(() => (estSiteSuggestion(slug.value) ? slug.value : null))

const { data: site } = await useSite(slug)
const {
  data: sections,
  error: sectionsError,
  refresh: refreshSections,
} = await useSiteSections(slug, 'CONTACT')

const nomCourt = computed(() => site.value?.nomCourt ?? site.value?.nom ?? slug.value)
const vars = computed(() => ({ nomCourt: nomCourt.value, nom: site.value?.nom }))

const seo = computed(() => sections.value?.seo as SeoData | undefined)
const contact = computed(() => sections.value?.contact as FormulaireData | undefined)
const suggestion = computed(() => sections.value?.suggestion as FormulaireData | undefined)

const coordonnees = computed(() => ({
  email: site.value?.email ?? null,
  telephone: site.value?.telephone ?? null,
  adresse: site.value?.adresse ?? null,
}))

const seoTitreRepli = computed(() => `Contact — ${nomCourt.value}`)

useSeoMeta({
  title: () => interpoler(seo.value?.title ?? seoTitreRepli.value, vars.value),
  description: () => interpoler(seo.value?.description ?? site.value?.description ?? '', vars.value),
  ogTitle: () => interpoler(seo.value?.title ?? seoTitreRepli.value, vars.value),
  ogDescription: () => interpoler(seo.value?.description ?? site.value?.description ?? '', vars.value),
  ogType: 'website',
})
</script>

<template>
  <div v-if="sectionsError" class="mx-auto max-w-xl px-6 py-40 text-center">
    <p class="text-ink/70">Impossible de charger cette page pour le moment.</p>
    <Button variant="outline" class="mt-4" @click="refreshSections()">Réessayer</Button>
  </div>

  <template v-else>
    <section class="pb-24 pt-32 md:pb-32 md:pt-40">
      <div class="mx-auto max-w-7xl px-6">
        <div class="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
          <div class="lg:col-span-5">
            <ContactIntro :section="contact" :coordonnees="coordonnees" :vars="vars" titre-repli="Contact" />
          </div>
          <div class="lg:col-span-7">
            <FilialeContactForm
              :key="slug"
              :slug="slug"
              :vars="vars"
              :message-succes="contact?.messageSucces ?? null"
              :mention="site?.groupe.mentionFormulaires ?? null"
              :email-secours="site?.email ?? null"
            />
          </div>
        </div>
      </div>
    </section>

    <SuggestionProduitForm
      v-if="siteSuggestion && suggestion"
      :site="siteSuggestion"
      :section="suggestion"
      :vars="vars"
      :mention="site?.groupe.mentionFormulaires ?? null"
      :email-secours="site?.email ?? null"
    />
  </template>
</template>
