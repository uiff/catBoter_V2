import { useEffect } from 'react'
import { toast } from 'sonner'
import { useRegisterSW } from 'virtual:pwa-register/react'

/** Zeigt bei neuer App-Version einen Update-Toast (ersetzt den alten
 *  Für-immer-Cache-Service-Worker, der Nutzer auf alten Versionen festhielt). */
export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  useEffect(() => {
    if (needRefresh) {
      toast('Update verfügbar', {
        description: 'Eine neue Version der App ist bereit.',
        duration: Infinity,
        action: {
          label: 'Neu laden',
          onClick: () => updateServiceWorker(true),
        },
      })
    }
  }, [needRefresh, updateServiceWorker])

  return null
}
