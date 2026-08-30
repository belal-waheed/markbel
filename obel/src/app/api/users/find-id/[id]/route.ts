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
export async function GET(request: Request, context: any) {
  try {
    await connectToDatabase()
    const params = await context.params
    const id = params.id

    const user = await User.findOne({ id }).lean()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { password, _id, __v, ...safeProfile } = user as any
    return NextResponse.json(safeProfile)
  } catch (err: any) {
    console.error('[API User GET] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * PUT /api/users/[id]
 * Updates profile settings (except password).
 */
export async function PUT(request: Request, context: any) {
  try {
    await connectToDatabase()
    const params = await context.params
    const id = params.id

    const updateData = await request.json()
    delete updateData._id
    delete updateData.password // Password updates not supported via this route

    const user = await User.findOne({ id })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    Object.assign(user, updateData)
    await user.save()

    return NextResponse.json(user.toJSON())
  } catch (err: any) {
    console.error('[API User PUT] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
