// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE: src/app/api/habits/route.ts
// PURPOSE: Next.js API Route Handler for Habits Collection
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Habit from '@/models/Habit'

/**
 * GET /api/habits?userId=xxx
 * Retrieves the habit definitions configured by a user.
 */
export async function GET(request: Request) {
  try {
    await connectToDatabase()
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const habits = await Habit.find({ userId }).lean()
    return NextResponse.json(habits)
  } catch (err: any) {
    console.error('[API Habits GET] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * POST /api/habits
 * Creates a new habit definition record.
 */
export async function POST(request: Request) {
  try {
    await connectToDatabase()
    const body = await request.json()

    if (!body.userId || !body.name) {
      return NextResponse.json({ error: 'userId and name are required' }, { status: 400 })
    }

    const payload = {
      ...body,
      id: body.id || crypto.randomUUID() // Prefer client-provided ID for offline sync integrity
    }

    const habit = new Habit(payload)
    await habit.save()

    return NextResponse.json(habit.toJSON(), { status: 201 })
  } catch (err: any) {
    console.error('[API Habits POST] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
