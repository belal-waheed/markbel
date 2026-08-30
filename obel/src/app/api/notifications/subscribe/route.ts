// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE: src/app/api/notifications/subscribe/route.ts
// PURPOSE: Next.js API Route Handler for Registering Push Subscriptions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import PushSubscription from '@/models/PushSubscription'

export async function POST(request: Request) {
  try {
    await connectToDatabase()
    const { userId, subscription, timezone } = await request.json()

    if (!userId || !subscription || !subscription.endpoint) {
      console.warn('[API Subscribe] Missing required fields: userId or subscription.endpoint')
      return NextResponse.json({ error: 'userId and active subscription endpoint are required' }, { status: 400 })
    }

    // Validate subscription structure
    if (!subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
      console.warn('[API Subscribe] Invalid subscription structure: missing keys')
      return NextResponse.json({ error: 'Subscription must include encryption keys (p256dh, auth)' }, { status: 400 })
    }

    // Upsert the subscription atomically to prevent concurrent insert/duplicate key errors
    await PushSubscription.findOneAndUpdate(
      { 'subscription.endpoint': subscription.endpoint },
      {
        userId,
        subscription,
        timezone: timezone || 'UTC',
        createdAt: new Date().toISOString()
      },
      { upsert: true, new: true }
    )

    console.log(`[API Subscribe] Successfully registered/updated subscription for user ${userId}: ${subscription.endpoint.substring(0, 50)}...`)
    return NextResponse.json({ success: true, message: 'Subscription successfully registered!' }, { status: 201 })
  } catch (err: any) {
    console.error('[API Subscribe] Registration failure:', err.message || err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
