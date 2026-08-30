// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE: src/app/api/tasks/route.ts
// PURPOSE: Next.js API Route Handler for Tasks Collection
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Task from '@/models/Task'

/**
 * GET /api/tasks?userId=xxx
 * Retrieves the tasks associated with a specific user.
 */
export async function GET(request: Request) {
  try {
    await connectToDatabase()
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId parameter is required' }, { status: 400 })
    }

    const tasks = await Task.find({ userId }).sort({ order: 1 }).lean()
    return NextResponse.json(tasks)
  } catch (err: any) {
    console.error('[API Tasks GET] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * POST /api/tasks
 * Creates a new task with serverless UUID generation.
 */
export async function POST(request: Request) {
  try {
    await connectToDatabase()
    const body = await request.json()

    if (!body.userId || !body.title) {
      return NextResponse.json({ error: 'userId and title are required fields' }, { status: 400 })
    }

    const payload = {
      ...body,
      id: body.id || crypto.randomUUID() // Prefer client-provided ID for offline sync integrity
    }

    const task = new Task(payload)
    await task.save()

    return NextResponse.json(task.toJSON(), { status: 201 })
  } catch (err: any) {
    console.error('[API Tasks POST] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
