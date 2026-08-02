import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'system' | 'light' | 'dark'
export type Tab = 'dashboard' | 'plans' | 'stats' | 'settings'
/** Sortierung der Heute-Liste: 'desc' = neueste Fütterung zuoberst */
export type TimelineOrder = 'desc' | 'asc'

const HASH_TO_TAB: Record<string, Tab> = {
  '#/': 'dashboard',
  '#/plans': 'plans',
  '#/stats': 'stats',
  '#/settings': 'settings',
}
const TAB_TO_HASH: Record<Tab, string> = {
  dashboard: '#/',
  plans: '#/plans',
  stats: '#/stats',
  settings: '#/settings',
}

interface UiState {
  theme: Theme
  tab: Tab
  timelineOrder: TimelineOrder
  setTheme: (theme: Theme) => void
  setTab: (tab: Tab) => void
  setTimelineOrder: (order: TimelineOrder) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'system',
      tab: HASH_TO_TAB[window.location.hash] ?? 'dashboard',
      timelineOrder: 'desc',
      setTheme: (theme) => {
        set({ theme })
        applyTheme(theme)
      },
      setTab: (tab) => {
        set({ tab })
        if (window.location.hash !== TAB_TO_HASH[tab]) {
          window.location.hash = TAB_TO_HASH[tab]
        }
      },
      setTimelineOrder: (timelineOrder) => set({ timelineOrder }),
    }),
    {
      name: 'catboter.ui',
      partialize: (state) => ({ theme: state.theme, timelineOrder: state.timelineOrder }),
    },
  ),
)

function isDark(theme: Theme): boolean {
  return (
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  )
}

export function applyTheme(theme: Theme) {
  const dark = isDark(theme)
  document.documentElement.classList.toggle('dark', dark)
  const meta = document.querySelector('meta[name="theme-color"]:not([media])')
    ?? document.createElement('meta')
  meta.setAttribute('name', 'theme-color')
  meta.setAttribute('content', dark ? '#101318' : '#f7f9fa')
  if (!meta.parentElement) document.head.appendChild(meta)
}

/** Einmal beim App-Start aufrufen: Theme anwenden + auf System-/Hash-Änderungen hören. */
export function initUiBindings() {
  applyTheme(useUiStore.getState().theme)

  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => applyTheme(useUiStore.getState().theme))

  window.addEventListener('hashchange', () => {
    const tab = HASH_TO_TAB[window.location.hash]
    if (tab && tab !== useUiStore.getState().tab) {
      useUiStore.setState({ tab })
    }
  })
}
