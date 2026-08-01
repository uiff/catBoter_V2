import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, HardDriveDownload, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { CollapsibleCard } from '@/components/ui/CollapsibleCard'
import { Button } from '@/components/ui/Button'
import { ConfirmSheet } from '@/components/ui/ConfirmSheet'
import { Skeleton } from '@/components/ui/Misc'
import { api, ApiError } from '@/lib/api'
import { queryClient } from '@/App'

/** ISO-String -> "DD.MM.YYYY HH:MM" */
function formatBackupDate(iso: string | undefined): string {
  if (!iso) return '–'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '–'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Backup: Info zum letzten Backup, Download (erstellt frisch) und Wiederherstellung. */
export function BackupCard() {
  const info = useQuery({ queryKey: ['backup-info'], queryFn: api.getBackupInfo })

  const fileInput = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [restoring, setRestoring] = useState(false)

  const download = () => {
    // Navigation statt fetch - der Browser übernimmt den Datei-Download.
    window.location.href = api.backupDownloadUrl
    // Das Backend erstellt dabei ein frisches Backup - Info kurz danach aktualisieren.
    setTimeout(() => queryClient.invalidateQueries({ queryKey: ['backup-info'] }), 1500)
  }

  const onFileChosen = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    // Input zurücksetzen, damit dieselbe Datei erneut wählbar bleibt.
    event.target.value = ''
    if (file) setPendingFile(file)
  }

  const restore = async () => {
    if (!pendingFile) return
    setRestoring(true)
    try {
      await api.restoreBackup(pendingFile)
      toast.success('Wiederhergestellt - Backend startet neu…')
      setPendingFile(null)
      // Nach dem Neustart (ConnectionBanner überbrückt die Lücke) alles neu laden.
      setTimeout(() => queryClient.invalidateQueries(), 8000)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Wiederherstellung fehlgeschlagen')
    } finally {
      setRestoring(false)
    }
  }

  return (
    <CollapsibleCard title="Backup" icon={<HardDriveDownload className="h-4 w-4" />}>
      <div className="space-y-3 pt-1">
        {info.isLoading ? (
          <Skeleton className="h-5 w-full" />
        ) : (
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Letztes Backup</span>
            <span className="tnum">
              {info.data?.exists
                ? `${formatBackupDate(info.data.created)} · ${Math.round((info.data.size ?? 0) / 1024)} KB`
                : '–'}
            </span>
          </div>
        )}

        <div className="space-y-2">
          <Button variant="secondary" className="w-full" onClick={download}>
            <Download className="h-4 w-4" />
            Backup herunterladen
          </Button>
          <Button variant="outline" className="w-full" onClick={() => fileInput.current?.click()}>
            <Upload className="h-4 w-4" />
            Wiederherstellen
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".tar.gz,application/gzip"
            className="hidden"
            onChange={onFileChosen}
          />
        </div>
      </div>

      <ConfirmSheet
        open={pendingFile !== null}
        onClose={() => setPendingFile(null)}
        onConfirm={restore}
        title="Backup wiederherstellen?"
        description="Alle Daten und Einstellungen werden durch das Backup ersetzt. Das Backend startet danach neu."
        confirmLabel="Wiederherstellen"
        danger
        loading={restoring}
      />
    </CollapsibleCard>
  )
}
