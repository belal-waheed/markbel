// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE: src/app/api/users/info/[id]/route.ts
// PURPOSE: Next.js API Route Handler for Updating UserInfo Accumulator (PUT)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import UserInfo from '@/models/UserInfo'

/**
 * PUT /api/users/info/[id]
 * Updates UserInfo settings, progress, and 30-day analytics arrays.
 * Implements the Last-Update-Wins (LWW) sync conflict strategy.
 */
export async function PUT(request: Request, context: any) {
  try {
    await connectToDatabase()
    const params = await context.params
    const id = params.id // Represents the userId

    const incomingData = await request.json()
    delete incomingData._id

    const existingInfo = await UserInfo.findOne({ userId: id })
    if (!existingInfo) {
      // Seed if not exists (fallback offline-first recovery)
      const newInfo = new UserInfo({
        ...incomingData,
        userId: id
      })
      await newInfo.save()
      return NextResponse.json(newInfo.toJSON())
    }

    // ── LWW CONFLICT PROTOCOL ───────────────────────────────────────
    const incomingTime = new Date(incomingData.updatedAt || new Date().toISOString()).getTime()
    const serverTime = new Date(existingInfo.updatedAt || new Date().toISOString()).getTime()

    if (incomingTime < serverTime) {
      console.log(`[LWW Sync] Outdated client payload rejected for user ${id}. Server: ${existingInfo.updatedAt}, Client: ${incomingData.updatedAt}`)
      // Reject and return authoritative newer server record to trigger client update
      return NextResponse.json(existingInfo.toJSON(), { status: 409 })
    }

    // Client is newer: overwrite server
    Object.assign(existingInfo, incomingData)
    await existingInfo.save()

    return NextResponse.json(existingInfo.toJSON())
  } catch (err: any) {
    console.error('[API UserInfo PUT] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
