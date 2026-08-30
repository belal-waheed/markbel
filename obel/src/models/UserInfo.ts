// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE: src/models/UserInfo.ts
// PURPOSE: Mongoose Schema + Types for UserInfo rolling accumulator
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import mongoose, { Document, Schema, Model } from 'mongoose'
import { IUserInfo } from '../types'

// Define Document extending IUserInfo and mongoose.Document
export interface IUserInfoDocument extends IUserInfo, Document {}

const UserInfoSchema = new Schema<IUserInfoDocument>(
  {
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true, unique: true, index: true },
    xp: { type: Number, default: 0 },
    taskLists: {
      type: [
        {
          id: { type: String, required: true },
          title: { type: String, required: true },
          order: { type: Number, required: true }
        }
      ],
      default: []
    },
    settings: {
      theme: { type: String, default: 'deep-plum' },
      soundEnabled: { type: Boolean, default: true },
      hapticsEnabled: { type: Boolean, default: true }
    },
    today: {
      dateStr: { type: String, default: '' },
      caffeineMg: { type: Number, default: 0 },
      caffeineLogs: [
        {
          time: { type: String, required: true },
          mg: { type: Number, required: true }
        }
      ],
      pomoMinutes: { type: Number, default: 0 },
      pomoSessions: { type: Number, default: 0 },
      habitsCompleted: { type: [String], default: [] },
      tasksCompleted: { type: [String], default: [] }
    },
    stats: {
      lifetimeCaffeineMg: { type: Number, default: 0 },
      lifetimeCaffeineCups: { type: Number, default: 0 },
      lifetimePomoMinutes: { type: Number, default: 0 },
      lifetimePomoSessions: { type: Number, default: 0 },
      lifetimeHabitsCount: { type: Number, default: 0 },
      
      caffeineHistory30Days: { type: [Number], default: [] },
      pomoHistory30Days: { type: [Number], default: [] },
      habitsHistory30Days: { type: [Number], default: [] }
    },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true }
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

const UserInfo: Model<IUserInfoDocument> =
  mongoose.models.UserInfo || mongoose.model<IUserInfoDocument>('UserInfo', UserInfoSchema)

export default UserInfo
