// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE: src/app/api/users/login/route.ts
// PURPOSE: Next.js API Route Handler for User Authentication Login
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectToDatabase } from '@/lib/mongodb'
import User from '@/models/User'

const SALT_ROUNDS = 10

export async function POST(request: Request) {
  try {
    await connectToDatabase()
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const user = await User.findOne({ email })
    if (!user) {
      return NextResponse.json({ error: 'No account found with this email' }, { status: 401 })
    }

    if (!user.password) {
      return NextResponse.json({ error: 'User account has no password set' }, { status: 401 })
    }

    let isValid = false
    
    // Support transition from legacy plain-text passwords to hashed passwords
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
      isValid = bcrypt.compareSync(password, user.password)
    } else {
      isValid = user.password === password
      if (isValid) {
        // Automatically upgrade password to secure hash
        user.password = bcrypt.hashSync(password, SALT_ROUNDS)
        await user.save()
      }
    }

    if (!isValid) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
    }

    // toJSON removes Mongoose internals and password field securely
    return NextResponse.json(user.toJSON())
  } catch (err: any) {
    console.error('[API Login] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
