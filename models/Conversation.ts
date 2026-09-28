import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Persisted AI conversations (Phase 1).
 *
 * A conversation is owned by exactly one user (userId = session email).
 * Messages store ONLY what the UI needs to render the thread:
 *  - role: user | assistant | system
 *  - content: rendered text (token-stream details are transport, not state)
 *
 * Provenance fields (provider, analyticsUsed, sources) make assistant
 * messages auditable without leaking provider payloads.
 */

export type ConversationRole = 'user' | 'assistant' | 'system';

export interface IMessage {
  role: ConversationRole;
  content: string;
  createdAt: Date;
  /** Which provider answered (assistant messages only, when known). */
  provider?: string;
  /** Which agent/graph produced the message (e.g. 'stock', 'forex', 'main'). */
  agent?: string;
}

export interface IConversation extends Document {
  userId: string;
  title: string;
  /** Chat context: which graph the conversation belongs to. */
  chatType: 'main' | 'stock' | 'forex';
  messages: IMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    role: {
      type: String,
      required: true,
      enum: ['user', 'assistant', 'system'],
    },
    content: {
      type: String,
      required: true,
    },
    provider: {
      type: String,
    },
    agent: {
      type: String,
    },
  },
  { _id: false, timestamps: false }
);

const ConversationSchema = new Schema<IConversation>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    chatType: {
      type: String,
      required: true,
      enum: ['main', 'stock', 'forex'],
      default: 'main',
    },
    messages: {
      type: [MessageSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Fast user listing, newest first.
ConversationSchema.index({ userId: 1, createdAt: -1 });

const Conversation: Model<IConversation> =
  mongoose.models.Conversation ||
  mongoose.model<IConversation>('Conversation', ConversationSchema);

export default Conversation;
