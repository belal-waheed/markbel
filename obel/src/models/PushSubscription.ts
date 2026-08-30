// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE: src/models/PushSubscription.ts
// PURPOSE: Mongoose Schema + Types for PWA Web Push Subscriptions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import mongoose, { Document, Schema, Model } from 'mongoose'

export interface IPushSubscription {
  userId: string
  subscription: {
    endpoint: string
    keys: {
      p256dh: string
      auth: string
    }
  }
  timezone?: string
  createdAt: string
}

export interface IPushSubscriptionDocument extends IPushSubscription, Document {}

const PushSubscriptionSchema = new Schema<IPushSubscriptionDocument>(
  {
    userId: { type: String, required: true, index: true },
    subscription: {
      endpoint: { type: String, required: true, unique: true },
      keys: {
        p256dh: { type: String, required: true },
        auth: { type: String, required: true }
      }
    },
    timezone: { type: String, default: 'UTC' },
    createdAt: { type: String, required: true }
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

const PushSubscription: Model<IPushSubscriptionDocument> =
  mongoose.models.PushSubscription || mongoose.model<IPushSubscriptionDocument>('PushSubscription', PushSubscriptionSchema)

export default PushSubscription
