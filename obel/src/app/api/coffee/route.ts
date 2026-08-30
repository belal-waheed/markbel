// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE: src/app/api/coffee/route.ts
// PURPOSE: Next.js API Routes for Loading and Creating Coffee Log Entries
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Coffee from '@/models/Coffee'

export async function GET(request: Request) {
  try {
    await connectToDatabase()
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    const logs = await Coffee.find({ userId }).sort({ timestamp: -1 })
    return NextResponse.json(logs)
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error'
    console.error('[API Coffee GET] Error:', err)
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase()
    let body: any = {}
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
    }

    // Set server generated ID if none provided
    const newId = body.id || `coffee-${crypto.randomUUID()}`
    const coffeeDoc = new Coffee({
      ...body,
      id: newId
    })

    await coffeeDoc.save()
    return NextResponse.json(coffeeDoc.toJSON())
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error'
    console.error('[API Coffee POST] Error:', err)
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
