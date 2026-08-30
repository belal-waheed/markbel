// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE: src/app/api/cron/reminders/route.ts
// PURPOSE: Next.js Cron API Handler for Dispatching Hourly Push Notifications
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import webpush from 'web-push'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { connectToDatabase } from '@/lib/mongodb'
import Habit from '@/models/Habit'
import Task from '@/models/Task'
import PushSubscription from '@/models/PushSubscription'

dayjs.extend(utc)
dayjs.extend(timezone)

// Initialize VAPID details securely from env configuration
const vapidEmail = 'mailto:support@obel.app'
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const privateKey = process.env.VAPID_PRIVATE_KEY || ''

if (publicKey && privateKey) {
  webpush.setVapidDetails(vapidEmail, publicKey, privateKey)
}

export async function GET(request: Request) {
  try {
    // 1. Authorization check for external cron call
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('cron_key')
    const secretKey = process.env.CRON_SECRET_KEY

    if (secretKey && key !== secretKey) {
      return NextResponse.json({ error: 'Unauthorized cron key access' }, { status: 401 })
    }

    if (!publicKey || !privateKey) {
      return NextResponse.json({ error: 'VAPID keys not configured in environment variables' }, { status: 500 })
    }

    await connectToDatabase()

    let totalNotificationsSent = 0
    let processedDevices = 0

    // Fetch all active device push subscriptions
    const subscriptions = await PushSubscription.find({}).lean()

    console.log(`[Cron Reminder] Loaded ${subscriptions.length} active device subscriptions for scanning.`)

    for (const sub of subscriptions) {
      const subTimezone = sub.timezone || 'UTC'
      let localNow
      try {
        localNow = dayjs().tz(subTimezone)
      } catch {
        console.warn(`[Cron Reminder] Invalid timezone ${subTimezone} on sub ${sub._id}, fallback to UTC`)
        localNow = dayjs().tz('UTC')
      }

      const localTodayStr = localNow.format('YYYY-MM-DD')
      const localTimeStr = localNow.format('HH:mm')
      processedDevices++

      // A. SCAN HABITS FOR THIS DEVICE
      const habitsToRemind = await Habit.find({
        userId: sub.userId,
        reminderTime: localTimeStr
      }).lean()

      for (const habit of habitsToRemind) {
        const payload = JSON.stringify({
          title: `Habit Reminder: ${habit.name}`,
          body: habit.description || `Don't break your streak! Time to complete your habit.`,
          icon: '/icons/badge-habit.png',
          badge: '/icons/badge-habit.svg',
          vibrate: [150, 50, 150],
          data: { url: '/habits' }
        })

        try {
          if (!sub.subscription?.endpoint || !sub.subscription?.keys?.p256dh || !sub.subscription?.keys?.auth) {
            console.warn(`[Cron Reminder] Invalid subscription structure for user ${sub.userId}, skipping`)
            continue
          }

          await webpush.sendNotification(sub.subscription as any, payload)
          totalNotificationsSent++
          console.log(`[Cron Reminder] Sent habit reminder for ${habit.name} to ${sub.subscription.endpoint.substring(0, 50)}... at local time ${localTimeStr} (${subTimezone}).`)
        } catch (err: any) {
          const endpoint = sub.subscription?.endpoint?.substring(0, 50) || 'unknown'
          console.error(`[Cron Reminder] Failed to send habit reminder to ${endpoint}...: ${err.message}`)

          if (err.statusCode === 410 || err.statusCode === 404) {
            console.log(`[Cron Reminder] Pruning invalid subscription endpoint`)
            await PushSubscription.deleteOne({ 'subscription.endpoint': sub.subscription?.endpoint })
          }
        }
      }

      // B. SCAN TASKS FOR THIS DEVICE
      const tasksToRemind = await Task.find({
        userId: sub.userId,
        status: { $ne: 'done' },
        dueDate: { $regex: new RegExp(`^${localTodayStr}`) },
        scheduledTime: localTimeStr
      }).lean()

      for (const task of tasksToRemind) {
        const payload = JSON.stringify({
          title: `Task Reminder: ${task.title}`,
          body: 'Time to get this done! Open Obel to update progress.',
          icon: '/icons/badge-task.png',
          badge: '/icons/badge-task.svg',
          vibrate: [200, 100, 200],
          data: { url: '/tasks' }
        })

        try {
          if (!sub.subscription?.endpoint || !sub.subscription?.keys?.p256dh || !sub.subscription?.keys?.auth) {
            console.warn(`[Cron Reminder] Invalid subscription structure for user ${sub.userId}, skipping`)
            continue
          }

          await webpush.sendNotification(sub.subscription as any, payload)
          totalNotificationsSent++
          console.log(`[Cron Reminder] Sent task reminder for ${task.title} to ${sub.subscription.endpoint.substring(0, 50)}... at local time ${localTimeStr} (${subTimezone}).`)
        } catch (err: any) {
          const endpoint = sub.subscription?.endpoint?.substring(0, 50) || 'unknown'
          console.error(`[Cron Reminder] Failed to send task reminder to ${endpoint}...: ${err.message}`)

          if (err.statusCode === 410 || err.statusCode === 404) {
            console.log(`[Cron Reminder] Pruning invalid subscription endpoint`)
            await PushSubscription.deleteOne({ 'subscription.endpoint': sub.subscription?.endpoint })
          }
        }
      }
    }

    console.log(`[Cron Reminder] Scan completed. Total devices processed: ${processedDevices}, push notifications dispatched: ${totalNotificationsSent}`)

    return NextResponse.json({
      success: true,
      processedDevices,
      dispatchedNotifications: totalNotificationsSent
    })
  } catch (err: any) {
    console.error('[Cron Reminder Route] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
