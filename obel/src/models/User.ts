// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE: src/models/User.ts
// PURPOSE: Mongoose Schema + Types for Auth User
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import mongoose, { Document, Schema, Model } from 'mongoose'

export interface IUser {
  id: string
  name: string
  email: string
  password?: string
  avatar: string
  totalFocusHours: string
  xp: number
  level: number
  coffeeCups: number
  longestFocusStreak: number
  activeTheme: string
  createdAt: string
  taskLists?: unknown
  noteFolders?: unknown
  pomodoroSettings?: unknown
  sessionHistory?: unknown
  noteSettings?: unknown
  openNoteIds?: unknown
  totalFocusSeconds?: number
  sessionsCompleted?: number
}

export interface IUserDocument extends IUser, Document {}

const tryParse = (val: unknown): unknown => {
  if (typeof val === 'string') {
    try {
      return JSON.parse(val)
    } catch {
      return val
    }
  }
  return val
}

const UserSchema = new Schema<IUserDocument>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    avatar: { type: String, default: '' },
    totalFocusHours: { type: String, default: '0' },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    coffeeCups: { type: Number, default: 0 },
    longestFocusStreak: { type: Number, default: 0 },
    activeTheme: { type: String, default: 'dark' },
    createdAt: { type: String, required: true },
    
    // Complex fields with auto-parsing setters
    taskLists: { 
      type: Schema.Types.Mixed, 
      default: [],
      set: tryParse
    },
    noteFolders: { 
      type: Schema.Types.Mixed, 
      default: [],
      set: tryParse
    },
    pomodoroSettings: { 
      type: Schema.Types.Mixed, 
      default: {},
      set: tryParse
    },
    sessionHistory: { 
      type: Schema.Types.Mixed, 
      default: [],
      set: tryParse
    },
    noteSettings: {
      type: Schema.Types.Mixed,
      default: {
        fontSize: '16px',
        lineHeight: '1.6',
        editorTheme: 'atomone',
        fontFamily: 'Google Sans Code'
      },
      set: tryParse
    },
    openNoteIds: {
      type: Schema.Types.Mixed,
      default: [],
      set: tryParse
    },
    totalFocusSeconds: { type: Number, default: 0 },
    sessionsCompleted: { type: Number, default: 0 }
  },
  {
    timestamps: false,
    toJSON: {
      transform: (doc, ret) => {
        const cleanRet = ret as Partial<Record<string, unknown>>
        delete cleanRet._id
        delete cleanRet.__v
        // Never return password hash in API payloads
        delete cleanRet.password
        return cleanRet
      }
    }
  }
)

const User: Model<IUserDocument> =
  mongoose.models.User || mongoose.model<IUserDocument>('User', UserSchema)

export default User
