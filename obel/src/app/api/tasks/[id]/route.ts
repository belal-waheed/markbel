// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE: src/app/api/tasks/[id]/route.ts
// PURPOSE: Next.js API Route Handler for Individual Tasks (PUT & DELETE)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Task from '@/models/Task'

/**
 * PUT /api/tasks/[id]
 * Updates an individual task record. Incorporates LWW sync check.
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

    const existingTask = await Task.findOne({ id })
    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // ── LWW SYNC PROTOCOL ───────────────────────────────────────────
    const incomingTime = new Date((incomingData.updatedAt as string) || new Date().toISOString()).getTime()
    const serverTime = new Date(existingTask.updatedAt || new Date().toISOString()).getTime()

    if (incomingTime < serverTime) {
      console.log(`[LWW Task Sync] Rejected older update for task ${id}. Server: ${existingTask.updatedAt}, Client: ${incomingData.updatedAt}`)
      return NextResponse.json(existingTask.toJSON(), { status: 409 })
    }

    Object.assign(existingTask, incomingData)
    if ('subtasks' in incomingData) {
      existingTask.markModified('subtasks')
    }
    await existingTask.save()

    return NextResponse.json(existingTask.toJSON())
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error'
    console.error('[API Task PUT] Error:', err)
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}

/**
 * DELETE /api/tasks/[id]
 * Deletes an individual task from the database.
 */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await connectToDatabase()
    const params = await context.params
    const id = params.id

    const result = await Task.deleteOne({ id })
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Task not found or already deleted' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error'
    console.error('[API Task DELETE] Error:', err)
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
