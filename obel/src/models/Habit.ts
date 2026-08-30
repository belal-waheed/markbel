// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE: src/models/Habit.ts
// PURPOSE: Mongoose Schema + Types for Habit
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import mongoose, { Document, Schema, Model } from 'mongoose'
import { IHabit } from '../types'

export interface IHabitDocument extends IHabit, Document {}

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

const HabitSchema = new Schema<IHabitDocument>(
  {
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    frequency: { type: String, default: 'daily' },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
    icon: { type: String },
    color: { type: String },
    customDays: {
      type: [Number],
      default: [],
      set: tryParse
    },
    reminderTime: { type: String },
    goalTarget: { type: Number },
    goalUnit: { type: String },
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    completedDates: { type: [String], default: [] },
    goalProgress: { type: Schema.Types.Mixed, default: {} },
    order: { type: Number }
  },
  {
    toJSON: {
      transform: (doc, ret) => {
        const cleanRet = ret as Partial<Record<string, unknown>>
        delete cleanRet._id
        delete cleanRet.__v
        return cleanRet
      }
    }
  }
)

// Ensure compound index for duplicate protection
HabitSchema.index({ userId: 1, name: 1, createdAt: 1 }, { unique: true })

const Habit: Model<IHabitDocument> =
  mongoose.models.Habit || mongoose.model<IHabitDocument>('Habit', HabitSchema)

export default Habit
