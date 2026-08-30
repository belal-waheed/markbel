// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE: src/app/api/habits/[id]/route.ts
// PURPOSE: Next.js API Route Handler for Individual Habits (PUT & DELETE)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Habit from '@/models/Habit'

/**
 * PUT /api/habits/[id]
 * Updates habit definition, streak counters, or completions.
 * Utilizes Last-Update-Wins (LWW) conflict checking.
 */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await connectToDatabase()
    const params = await context.params
    const id = params.id

    let incomingData: Partial<Record<string, unknown>> = {}
    try {
      incomingData = await request.json()
    } catch {
      // Gracefully handle empty or invalid JSON payload
    }
    delete incomingData._id

    const existingHabit = await Habit.findOne({ id })
    if (!existingHabit) {
      return NextResponse.json({ error: 'Habit not found' }, { status: 404 })
    }

    // ── LWW SYNC PROTOCOL ───────────────────────────────────────────
    const incomingTime = new Date((incomingData.updatedAt as string) || new Date().toISOString()).getTime()
    const serverTime = new Date(existingHabit.updatedAt || new Date().toISOString()).getTime()

    if (incomingTime < serverTime) {
      console.log(`[LWW Habit Sync] Rejected older update for habit ${id}. Server: ${existingHabit.updatedAt}, Client: ${incomingData.updatedAt}`)
      return NextResponse.json(existingHabit.toJSON(), { status: 409 })
    }

    Object.assign(existingHabit, incomingData)
    await existingHabit.save()

    return NextResponse.json(existingHabit.toJSON())
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error'
    console.error('[API Habit PUT] Error:', err)
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}

/**
 * DELETE /api/habits/[id]
 * Deletes a habit definition from the database.
 */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await connectToDatabase()
    const params = await context.params
    const id = params.id

    const result = await Habit.deleteOne({ id })
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Habit not found or already deleted' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error'
    console.error('[API Habit DELETE] Error:', err)
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
