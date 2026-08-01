import { useEffect, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  /** true = Sheet kann nicht weggewischt/geschlossen werden (z. B. laufende Fütterung) */
  locked?: boolean
  /** Vollhöhen-Sheet für lange Formulare */
  full?: boolean
}

/**
 * Mobile: Bottom-Sheet mit Drag-Handle. Desktop (md+): zentrierter Dialog.
 * Eine Komponente, zwei Erscheinungen.
 */
export function Sheet({ open, onClose, title, children, locked = false, full = false }: SheetProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !locked) onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, locked, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/50"
            onClick={locked ? undefined : onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: '100%', opacity: 0.8 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0.8 }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
            drag={locked ? false : 'y'}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (!locked && (info.offset.y > 120 || info.velocity.y > 800)) onClose()
            }}
            className={cn(
              'relative z-10 flex w-full flex-col bg-surface',
              'rounded-t-[20px] md:max-w-md md:rounded-lg md:shadow-xl',
              full ? 'h-[92dvh] md:h-[85vh]' : 'max-h-[92dvh] md:max-h-[85vh]',
            )}
          >
            {/* Drag-Handle (nur mobil) */}
            <div className="flex justify-center pt-2.5 md:hidden">
              <div className="h-1 w-9 rounded-full bg-border" />
            </div>

            {(title || !locked) && (
              <div className="flex items-center justify-between px-4 pb-2 pt-3 md:pt-4">
                <h2 className="text-base font-semibold">{title}</h2>
                {!locked && (
                  <button
                    onClick={onClose}
                    aria-label="Schliessen"
                    className="-mr-1.5 rounded-md p-1.5 text-muted-foreground hover:bg-surface-2"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pb-safe">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
