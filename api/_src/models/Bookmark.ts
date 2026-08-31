import mongoose, { Document, Schema, Model } from 'mongoose'

export interface IBookmark {
  id: string
  userId: string
  title: string
  url: string
  description?: string
  image?: string
  favicon?: string
  siteName?: string
  author?: string
  publishedAt?: string
  contentType?: 'article' | 'video' | 'audio' | 'tweet' | 'code' | 'website'
  readingTime?: number
  wordCount?: number
  canonicalUrl?: string
  articleContent?: string
  group: string
  isRead?: boolean
  readAt?: string
  isPinned?: boolean
  remindAt?: string
  isArchived?: boolean
  archiveGroup?: string
  createdAt: string
  updatedAt: string
  version: number
  deletedAt?: string | null
}

export interface IBookmarkDocument extends IBookmark, Document {}

const BookmarkSchema = new Schema<IBookmarkDocument>(
  {
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    url: { type: String, required: true },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    favicon: { type: String, default: '' },
    siteName: { type: String, default: '' },
    author: { type: String, default: '' },
    publishedAt: { type: String, default: '' },
    contentType: {
      type: String,
      enum: ['article', 'video', 'audio', 'tweet', 'code', 'website'],
      default: 'website'
    },
    readingTime: { type: Number, default: 0 },
    wordCount: { type: Number, default: 0 },
    canonicalUrl: { type: String, default: '' },
    articleContent: { type: String, default: '' },
    group: { type: String, required: true, default: 'Unsorted' },
    isRead: { type: Boolean, default: false },
    readAt: { type: String, default: '' },
    isPinned: { type: Boolean, default: false },
    remindAt: { type: String, default: '' },
    isArchived: { type: Boolean, default: false },
    archiveGroup: { type: String, default: '' },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
    version: { type: Number, required: true, default: 0 },
    deletedAt: { type: String, default: null }
  },
  {
    toJSON: {
      transform: (doc, ret) => {
        const cleanRet = ret as Partial<Record<string, any>>
        delete cleanRet._id
        delete cleanRet.__v
        return cleanRet
      }
    }
  }
)

BookmarkSchema.index({ userId: 1, group: 1, createdAt: 1 })
BookmarkSchema.index({ userId: 1, isArchived: 1, isRead: 1 })

const Bookmark: Model<IBookmarkDocument> =
  mongoose.models.Bookmark || mongoose.model<IBookmarkDocument>('Bookmark', BookmarkSchema)

export default Bookmark
