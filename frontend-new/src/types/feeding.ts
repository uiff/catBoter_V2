export interface FeedingTime {
  time: string
  weight: number
  status?: boolean
  last_attempt?: string
  message?: string
  fed_amount?: number
}

export interface FeedingSchedule {
  [day: string]: FeedingTime[]
}

export interface AutoPlan {
  planName: string
  selectedDays: string[]
  feedingSchedule: FeedingSchedule
  weightMode: 'daily' | 'custom'
  dailyWeight?: number
  active: boolean
}

export interface RandomPlan {
  planName: string
  active: boolean
  startTime: string
  endTime: string
  feedingsPerDay: number
  weightPerFeeding: number
  selectedDays: string[]
  minIntervalMinutes?: number  // Minimum interval between feedings in minutes
}

export type FeedingPlan = AutoPlan | RandomPlan

export interface ManualFeedRequest {
  weight: number
  duration?: number
}
