// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE: src/app/api/users/info/route.ts
// PURPOSE: Next.js API Route Handler for UserInfo Accumulator (GET & POST)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import UserInfo from '@/models/UserInfo'

/**
 * GET /api/users/info?userId=xxx
 * Retrieves the rolling statistics and settings document.
 */
export async function GET(request: Request) {
  try {
    await connectToDatabase()
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const info = await UserInfo.findOne({ userId })
    if (!info) {
      return NextResponse.json(null) // Return null so store can trigger seeding
    }

    return NextResponse.json(info.toJSON())
  } catch (err: any) {
    console.error('[API UserInfo GET] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * POST /api/users/info
 * Seeds the initial rolling accumulator stats document upon signup.
 */
export async function POST(request: Request) {
  try {
    await connectToDatabase()
    const body = await request.json()

    if (!body.userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Check if one already exists
    const existing = await UserInfo.findOne({ userId: body.userId })
    if (existing) {
      return NextResponse.json({ error: 'UserInfo already seeded for this user' }, { status: 409 })
    }

    const info = new UserInfo(body)
    await info.save()

    return NextResponse.json(info.toJSON(), { status: 201 })
  } catch (err: any) {
    console.error('[API UserInfo POST] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
