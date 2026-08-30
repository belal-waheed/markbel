// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE: src/lib/rollover.ts
// PURPOSE: Date Transition / Rollover Cumulative Stats Aggregator
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import dayjs from 'dayjs'
import { IUserInfo } from '../types'

/**
 * Checks if the system needs to perform a daily stats rollover.
 * If the current date does not match today.dateStr, it rolls over
 * metrics to lifetime totals, updates rolling 30-day arrays, and resets today's stats.
 * 
 * @param userInfo The user profile document
 * @param forceDate Optional date string to force rollover check (primarily for testing)
 * @returns The updated IUserInfo document, or null if no rollover was needed.
 */
export function checkAndRollOver(userInfo: IUserInfo, forceDate?: string): IUserInfo | null {
  const currentDateStr = forceDate || dayjs().format('YYYY-MM-DD')
  const lastDate = userInfo.today.dateStr

  // 1. Initial configuration or same-date scenario: No rollover needed
  if (!lastDate) {
    userInfo.today.dateStr = currentDateStr
    userInfo.updatedAt = new Date().toISOString()
    return userInfo
  }

  if (lastDate === currentDateStr) {
    return null // No transition occurred
  }

  console.log(`[Rollover Engine] Transitioning stats from ${lastDate} to ${currentDateStr}...`)

  // 2. Accumulate today's achievements to lifetime metrics
  userInfo.stats.lifetimeCaffeineMg += userInfo.today.caffeineMg || 0
  userInfo.stats.lifetimeCaffeineCups += (userInfo.today.caffeineLogs || []).length
  userInfo.stats.lifetimePomoMinutes += userInfo.today.pomoMinutes || 0
  userInfo.stats.lifetimePomoSessions += userInfo.today.pomoSessions || 0
  userInfo.stats.lifetimeHabitsCount += (userInfo.today.habitsCompleted || []).length

  // Helper utility to push new values into historical rolling 30-day buffers
  const pushAndShift = (arr: number[], newValue: number): number[] => {
    const activeArr = Array.isArray(arr) ? [...arr] : []
    activeArr.push(newValue)
    while (activeArr.length > 30) {
      activeArr.shift() // Maintain strict cap of 30 items
    }
    return activeArr
  }

  // 3. Roll stats into 30-day analytics buffers
  userInfo.stats.caffeineHistory30Days = pushAndShift(
    userInfo.stats.caffeineHistory30Days,
    userInfo.today.caffeineMg || 0
  )
  userInfo.stats.pomoHistory30Days = pushAndShift(
    userInfo.stats.pomoHistory30Days,
    userInfo.today.pomoMinutes || 0
  )
  userInfo.stats.habitsHistory30Days = pushAndShift(
    userInfo.stats.habitsHistory30Days,
    (userInfo.today.habitsCompleted || []).length
  )

  // 4. Reset today transient counters for the new calendar day
  userInfo.today = {
    dateStr: currentDateStr,
    caffeineMg: 0,
    caffeineLogs: [],
    pomoMinutes: 0,
    pomoSessions: 0,
    habitsCompleted: [],
    tasksCompleted: []
  }

  // Update timestamps
  userInfo.updatedAt = new Date().toISOString()

  return userInfo
}
