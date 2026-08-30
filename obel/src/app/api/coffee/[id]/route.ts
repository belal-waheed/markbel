// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE: src/app/api/coffee/[id]/route.ts
// PURPOSE: Next.js API Route for Deleting Coffee Log Entries
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Coffee from '@/models/Coffee'

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await connectToDatabase()
    const params = await context.params
    const id = params.id
    if (!id) {
      return NextResponse.json({ error: 'Missing log ID' }, { status: 400 })
    }

    const result = await Coffee.deleteOne({ id })
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Coffee log entry not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error'
    console.error('[API Coffee DELETE] Error:', err)
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
