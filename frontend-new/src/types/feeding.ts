/** Fütterungsplan-Datenmodell (unverändert zum Backend - feedingPlans.json / randomPlans.json). */

export interface ScheduledFeeding {
  time: string
  weight: number
  status?: boolean | null
  attempts?: number
  fed_amount?: number
  last_attempt?: string
  message?: string
}

export interface AutoPlan {
  planName: string
  selectedDays: string[]
  feedingSchedule: Record<string, ScheduledFeeding[]>
  weightMode?: 'daily' | 'manual'
  dailyWeight?: number
  active: boolean
  isRandomGenerated?: boolean
  /** Anti-Schling: Portion über N Minuten in Schüben ausgeben (0/undefined = aus) */
  slowFeedMinutes?: number
  /** Frontend-Kompatibilitätsfelder, vom Backend gespiegelt */
  name?: string
  days?: string[]
}

export interface RandomPlan {
  planName: string
  active: boolean
  startTime?: string
  endTime?: string
  minInterval?: number
  maxInterval?: number
  minPause?: number
  dailyWeight?: number
  workdaysOnly?: boolean
  /** Anti-Schling: Portion über N Minuten in Schüben ausgeben (0/undefined = aus) */
  slowFeedMinutes?: number
  /** Alt-Format (anzahlbasiert): wird vom Backend weiterhin unterstützt */
  minFeedings?: number
  maxFeedings?: number
  minAmount?: number
  maxAmount?: number
  timeRanges?: Array<{ start: string; end: string }>
  selectedDays?: string[]
}

export const ALL_DAYS = [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
] as const
