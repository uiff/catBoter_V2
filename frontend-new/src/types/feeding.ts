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

export interface TimeRange {
  start: string
  end: string
}

export interface RandomPlan {
  planName: string
  active: boolean
  minFeedings: number
  maxFeedings: number
  minAmount: number
  maxAmount: number
  timeRanges: TimeRange[]
  selectedDays?: string[]  // Optional, may not be in all plans
}

export type FeedingPlan = AutoPlan | RandomPlan

export interface ManualFeedRequest {
  weight: number
  duration?: number
}
