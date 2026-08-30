// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE: src/app/api/notes/[id]/route.ts
// PURPOSE: Next.js API Route Handler for Individual Notes (GET, PUT & DELETE)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Note from '@/models/Note'

/**
 * GET /api/notes/[id]
 * Lazy-hydrates the heavy markdown body content of a note upon user selection.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await connectToDatabase()
    const params = await context.params
    const id = params.id

    const note = await Note.findOne({ id }).lean()
    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    return NextResponse.json(note)
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error'
    console.error('[API Note GET] Error:', err)
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}

/**
 * PUT /api/notes/[id]
 * Updates note metadata or rich markdown body content.
 * Employs Last-Update-Wins (LWW) conflict strategy.
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

    const existingNote = await Note.findOne({ id })
    if (!existingNote) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    // ── LWW SYNC PROTOCOL ───────────────────────────────────────────
    const incomingTime = new Date(incomingData.updatedAt as string || new Date().toISOString()).getTime()
    const serverTime = new Date(existingNote.updatedAt || new Date().toISOString()).getTime()

    if (incomingTime < serverTime) {
      console.log(`[LWW Note Sync] Rejected older update for note ${id}. Server: ${existingNote.updatedAt}, Client: ${incomingData.updatedAt}`)
      return NextResponse.json(existingNote.toJSON(), { status: 409 })
    }

    Object.assign(existingNote, incomingData)
    await existingNote.save()

    return NextResponse.json(existingNote.toJSON())
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error'
    console.error('[API Note PUT] Error:', err)
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}

/**
 * DELETE /api/notes/[id]
 * Deletes a note definition from the database.
 */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await connectToDatabase()
    const params = await context.params
    const id = params.id

    const result = await Note.deleteOne({ id })
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Note not found or already deleted' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error'
    console.error('[API Note DELETE] Error:', err)
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
