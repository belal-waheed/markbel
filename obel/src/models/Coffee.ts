// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE: src/models/Coffee.ts
// PURPOSE: Mongoose Schema + Types for Coffee Entry Tracking
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import mongoose, { Document, Schema, Model } from 'mongoose'

export interface ICoffee {
  id: string
  userId: string
  type: string
  caffeineMg: number
  mood: string
  timestamp: string
}

export interface ICoffeeDocument extends ICoffee, Document {}

const CoffeeSchema = new Schema<ICoffeeDocument>(
  {
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    type: { type: String, required: true },
    caffeineMg: { type: Number, required: true },
    mood: { type: String, required: true },
    timestamp: { type: String, required: true }
  },
  {
    timestamps: false,
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

const Coffee: Model<ICoffeeDocument> =
  mongoose.models.Coffee || mongoose.model<ICoffeeDocument>('Coffee', CoffeeSchema)

export default Coffee
