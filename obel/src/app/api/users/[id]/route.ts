// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE: src/app/api/users/[id]/route.ts
// PURPOSE: Next.js API Route Handler for Individual User Profiles
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import User from '@/models/User'

/**
 * GET /api/users/[id]
 * Retrieves safe profile statistics for an individual user.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await connectToDatabase()
    const params = await context.params
    const id = params.id

    const user = await User.findOne({ id }).lean()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { password, _id, __v, ...safeProfile } = user as unknown as Record<string, unknown>
    return NextResponse.json(safeProfile)
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error'
    console.error('[API User GET] Error:', err)
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}

/**
 * PUT /api/users/[id]
 * Updates profile settings (except password).
 */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try { 
    await connectToDatabase()
    const params = await context.params
    const id = params.id

    let updateData: Partial<Record<string, unknown>> = {}
    try {
      updateData = await request.json()
    } catch {
      // Gracefully handle empty or invalid JSON payload
    }
    delete updateData._id
    delete updateData.password // Password updates not supported via this route

    let retries = 3
    let savedUser = null

    while (retries > 0) {
      try {
        const user = await User.findOne({ id })
        if (!user) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        Object.assign(user, updateData)

        const mixedFields = ['taskLists', 'noteFolders', 'pomodoroSettings', 'sessionHistory', 'noteSettings', 'openNoteIds']
        mixedFields.forEach((field) => {
          if (field in updateData) {
            user.markModified(field)
          }
        })

        savedUser = await user.save()
        break
      } catch (err: any) {
        if (err.name === 'VersionError' && retries > 1) {
          retries--
          console.warn(`[API User PUT] VersionError encountered for user ${id}. Retrying save... (${retries} attempts left)`)
          await new Promise((resolve) => setTimeout(resolve, 50))
        } else {
          throw err
        }
      }
    }

    if (!savedUser) {
      return NextResponse.json({ error: 'Failed to update user due to concurrency issues' }, { status: 500 })
    }

    return NextResponse.json(savedUser.toJSON())
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error'
    console.error('[API User PUT] Error:', err)
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
