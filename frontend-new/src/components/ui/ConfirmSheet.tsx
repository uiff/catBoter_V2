import type { ReactNode } from 'react'
import { Sheet } from './Sheet'
import { Button } from './Button'

interface ConfirmSheetProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: ReactNode
  confirmLabel?: string
  danger?: boolean
  loading?: boolean
}

/** Bestätigungsdialog als Bottom-Sheet - ersetzt window.confirm. */
export function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Bestätigen',
  danger = false,
  loading = false,
}: ConfirmSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {description && <p className="pb-4 text-sm text-muted-foreground">{description}</p>}
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onClose} disabled={loading}>
          Abbrechen
        </Button>
        <Button
          variant={danger ? 'danger' : 'primary'}
          className="flex-1"
          onClick={onConfirm}
          loading={loading}
        >
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  )
}
