// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE: src/app/api/sync/route.ts
// PURPOSE: Next.js API Route Handler for Incremental Sync Updates
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Note from '@/models/Note'
import Task from '@/models/Task'
import Habit from '@/models/Habit'

export async function GET(request: Request) {
  try {
    await connectToDatabase()
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const since = searchParams.get('since') // ISO string timestamp

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const query: Record<string, any> = { userId }
    if (since) {
      query.updatedAt = { $gt: since }
    }

    // Fetch incremental updates for all core items concurrently
    const [notes, tasks, habits] = await Promise.all([
      Note.find(query).lean(),
      Task.find(query).lean(),
      Habit.find(query).lean()
    ])

    return NextResponse.json({
      notes,
      tasks,
      habits,
      timestamp: new Date().toISOString()
    })
  } catch (err: any) {
    console.error('[API Sync GET] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
