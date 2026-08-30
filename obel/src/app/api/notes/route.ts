// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE: src/app/api/notes/route.ts
// PURPOSE: Next.js API Route Handler for Notes Collection
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Note from '@/models/Note'

/**
 * GET /api/notes?userId=xxx
 * Retrieves stubs of all notes (EXCLUDING heavy content field)
 * to maintain instant load times and reduce bandwidth.
 */
export async function GET(request: Request) {
  try {
    await connectToDatabase()
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Explicitly exclude the markdown content field to make lists incredibly lightweight!
    const notes = await Note.find({ userId }).select('-content').lean()
    return NextResponse.json(notes)
  } catch (err: any) {
    console.error('[API Notes GET] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * POST /api/notes
 * Creates a new markdown note record.
 */
export async function POST(request: Request) {
  try {
    await connectToDatabase()
    const body = await request.json()

    if (!body.userId || !body.title) {
      return NextResponse.json({ error: 'userId and title are required' }, { status: 400 })
    }

    const payload = {
      ...body,
      id: body.id || crypto.randomUUID() // Prefer client-provided ID for offline sync integrity
    }

    const note = new Note(payload)
    await note.save()

    return NextResponse.json(note.toJSON(), { status: 201 })
  } catch (err: any) {
    console.error('[API Notes POST] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
