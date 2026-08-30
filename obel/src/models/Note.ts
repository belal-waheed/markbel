// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE: src/models/Note.ts
// PURPOSE: Mongoose Schema + Types for Note
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import mongoose, { Document, Schema, Model } from 'mongoose'
import { INote } from '../types'

export interface INoteDocument extends INote, Document {}

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

const NoteSchema = new Schema<INoteDocument>(
  {
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    content: { type: String, default: '' },
    pinned: { type: Boolean, default: false },
    color: {
      type: String,
      enum: ['none', 'red', 'orange', 'green', 'blue', 'purple', 'pink'],
      default: 'none'
    },
    folderId: { type: String, default: 'hola-default' },
    linkedTaskIds: {
      type: [String],
      default: [],
      set: tryParse
    },
    audioMap: {
      type: Schema.Types.Mixed,
      default: {},
      set: tryParse
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

NoteSchema.index({ userId: 1, title: 1, createdAt: 1 }, { unique: true })

const Note: Model<INoteDocument> =
  mongoose.models.Note || mongoose.model<INoteDocument>('Note', NoteSchema)

export default Note
