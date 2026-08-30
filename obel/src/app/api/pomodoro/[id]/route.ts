// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE: src/app/api/pomodoro/[id]/route.ts
// PURPOSE: Next.js API Route for Saving User Pomodoro Analytics & Settings
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import User from '@/models/User'

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await connectToDatabase()
    const params = await context.params
    const userId = params.id
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    let body: any = {}
    try {
      body = await request.json()
    } catch {
      // Allow empty/invalid payloads gracefully
    }

    const user = await User.findOne({ id: userId })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (body.settings !== undefined) user.pomodoroSettings = body.settings
    if (body.sessionHistory !== undefined) user.sessionHistory = body.sessionHistory
    if (body.totalFocusSeconds !== undefined) user.totalFocusSeconds = body.totalFocusSeconds
    if (body.sessionsCompleted !== undefined) user.sessionsCompleted = body.sessionsCompleted

    // Explicitly mark mixed types as modified so Mongoose writes to MongoDB
    user.markModified('pomodoroSettings')
    user.markModified('sessionHistory')

    await user.save()

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error'
    console.error('[API Pomodoro PUT] Error:', err)
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
