// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE: src/app/api/users/route.ts
// PURPOSE: Next.js API Route Handler for User Profiles (GET & POST)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectToDatabase } from '@/lib/mongodb'
import User from '@/models/User'

const SALT_ROUNDS = 10

/**
 * GET /api/users?email=xxx
 * Searches for users by email.
 */
export async function GET(request: Request) {
  try {
    await connectToDatabase()
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    const query = email ? { email } : {}
    const users = await User.find(query).lean()

    // Strip passwords and mongo internals
    const safeUsers = users.map((user: any) => {
      const { password, _id, __v, ...rest } = user
      return rest
    })

    return NextResponse.json(safeUsers)
  } catch (err: any) {
    console.error('[API Users GET] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * POST /api/users (Signup)
 * Creates a new user profile.
 */
export async function POST(request: Request) {
  try {
    await connectToDatabase()
    const body = await request.json()

    if (!body.email || !body.name || !body.password) {
      return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 })
    }

    // Check if account already exists
    const existing = await User.findOne({ email: body.email }).lean()
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }

    // Hash the password securely before storing
    const hashedPassword = await bcrypt.hash(body.password, SALT_ROUNDS)

    const payload = {
      ...body,
      id: crypto.randomUUID(), // Assign authoritative client UUID
      password: hashedPassword
    }

    const user = new User(payload)
    await user.save()

    return NextResponse.json(user.toJSON(), { status: 201 })
  } catch (err: any) {
    console.error('[API Users POST] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
