// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE: src/models/Task.ts
// PURPOSE: Mongoose Schema + Types for Task
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import mongoose, { Document, Schema, Model } from 'mongoose'
import { ITask } from '../types'

export interface ITaskDocument extends ITask, Document {}

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

const TaskSchema = new Schema<ITaskDocument>(
  {
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    tags: {
      type: [String],
      default: [],
      set: tryParse
    },
    subtasks: {
      type: Schema.Types.Mixed,
      default: [],
      set: tryParse
    },
    status: {
      type: String,
      enum: ['todo', 'in-progress', 'done'],
      default: 'todo'
    },
    dueDate: { type: String, default: '' },
    createdAt: { type: String, required: true },
    completedAt: { type: String },
    focusSessions: { type: Number, default: 0 },
    focusTime: { type: Number, default: 0 },
    scheduledTime: { type: String },
    estimatedDuration: { type: Number },
    listId: { type: String },
    linkedNoteIds: {
      type: [String],
      default: [],
      set: tryParse
    },
    order: { type: Number, default: 0 },
    updatedAt: { type: String }
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

// Compound index for offline duplicate protection
TaskSchema.index({ userId: 1, title: 1, createdAt: 1 }, { unique: true })

const Task: Model<ITaskDocument> =
  mongoose.models.Task || mongoose.model<ITaskDocument>('Task', TaskSchema)

export default Task
