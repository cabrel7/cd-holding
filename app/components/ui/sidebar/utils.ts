import type { ComputedRef, Ref } from "vue"
import { createContext } from "reka-ui"

/** Largeur en dessous de laquelle la barre latérale devient un Sheet (1024 px = breakpoint lg). */
export const SIDEBAR_MOBILE_QUERY = "(max-width: 1023px)"

export const [useSidebar, provideSidebarContext] = createContext<{
  state: ComputedRef<"expanded" | "collapsed">
  open: Ref<boolean>
  setOpen: (value: boolean) => void
  isMobile: Ref<boolean>
  openMobile: Ref<boolean>
  setOpenMobile: (value: boolean) => void
  toggleSidebar: () => void
}>("Sidebar")
