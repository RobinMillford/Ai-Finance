/**
 * Conversation + message repositories.
 *
 * The old Mongo Conversation embedded a messages[] array; messages now live
 * in their own table (one row per message). Aggregations preserve the exact
 * API contracts the Phase 1 routes shipped:
 *  - list: title/chatType/timestamps + messageCount + lastMessageAt
 *  - thread: full messages ordered by created_at
 *  - append: insert + optional auto-retitle inside ONE transaction
 */

import { and, eq, desc, sql } from 'drizzle-orm';
import { getDb } from '../client';
import {
  conversations,
  messages,
  type Conversation,
  type Message,
} from '../schema';

export type ChatRole = 'user' | 'assistant' | 'system';
export type ChatType = 'main' | 'stock' | 'forex';

export interface MessageView {
  id: string;
  role: ChatRole;
  content: string;
  provider: string | null;
  agent: string | null;
  createdAt: string;
}

export interface ConversationSummaryView {
  id: string;
  title: string;
  chatType: ChatType;
  messageCount: number;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationThreadView {
  id: string;
  userId: string;
  title: string;
  chatType: ChatType;
  createdAt: string;
  updatedAt: string;
  messages: MessageView[];
}

function toMessageView(row: Message): MessageView {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    provider: row.provider,
    agent: row.agent,
    createdAt: row.createdAt.toISOString(),
  };
}

function toThreadView(row: Conversation, msgs: Message[]): ConversationThreadView {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    chatType: row.chatType,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    messages: msgs.map(toMessageView),
  };
}

export async function listConversations(
  userId: string
): Promise<ConversationSummaryView[]> {
  const rows = await getDb()
    .select({
      id: conversations.id,
      title: conversations.title,
      chatType: conversations.chatType,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
      messageCount: sql<number>`count(${messages.id})::int`,
      lastMessageAt: sql<string | null>`max(${messages.createdAt})`,
    })
    .from(conversations)
    .leftJoin(messages, eq(messages.conversationId, conversations.id))
    .where(eq(conversations.userId, userId))
    .groupBy(
      conversations.id,
      conversations.title,
      conversations.chatType,
      conversations.createdAt,
      conversations.updatedAt
    )
    .orderBy(desc(conversations.createdAt));

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    chatType: r.chatType,
    messageCount: r.messageCount,
    lastMessageAt: r.lastMessageAt ? new Date(r.lastMessageAt).toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function createConversation(
  userId: string,
  input: { title: string; chatType: ChatType; firstMessage?: { role: 'user' | 'assistant'; content: string } }
): Promise<ConversationThreadView> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const rows = await tx
      .insert(conversations)
      .values({ userId, title: input.title, chatType: input.chatType })
      .returning();
    const row: Conversation = rows[0];

    let msgs: Message[] = [];
    if (input.firstMessage) {
      const inserted = await tx
        .insert(messages)
        .values({
          conversationId: row.id,
          role: input.firstMessage.role,
          content: input.firstMessage.content,
        })
        .returning();
      msgs = inserted;
    }

    return toThreadView(row, msgs);
  });
}

export async function getConversationThread(
  userId: string,
  conversationId: string
): Promise<ConversationThreadView | null> {
  const rows = await getDb()
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const msgs = await getDb()
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);

  return toThreadView(row, msgs);
}

export async function appendMessage(
  userId: string,
  conversationId: string,
  input: {
    role: ChatRole;
    content: string;
    provider?: string;
    agent?: string;
    /** Auto-retitle an untitled conversation from this message (first user msg). */
    retitleIfUntitled?: string;
  }
): Promise<ConversationThreadView | null> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const owned = await tx
      .select({
        id: conversations.id,
        title: conversations.title,
        chatType: conversations.chatType,
        createdAt: conversations.createdAt,
      })
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
      .limit(1);
    if (owned.length === 0) return null;

    const values: Record<string, unknown> = {
      conversationId,
      role: input.role,
      content: input.content,
    };
    if (input.provider !== undefined) values.provider = input.provider;
    if (input.agent !== undefined) values.agent = input.agent;

    const inserted = await tx.insert(messages).values(values as any).returning();

    // Mirror the old route's auto-retitle: the FIRST user message on an
    // untitled conversation renames it — decided inside the same transaction
    // by counting existing messages (race-safe, unlike a client-side check).
    const priorUserMessages = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), eq(messages.role, 'user')));

    const shouldRetitle =
      input.role === 'user' &&
      (priorUserMessages[0]?.count ?? 0) === 1 && // only this message so far
      Boolean(input.retitleIfUntitled) &&
      (owned[0].title === 'New conversation' || !owned[0].title);

    let finalTitle = owned[0].title;
    if (shouldRetitle) {
      finalTitle = input.retitleIfUntitled!.slice(0, 200);
    }
    await tx
      .update(conversations)
      .set({ title: finalTitle, updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));

    const row: Conversation = {
      id: owned[0].id,
      userId,
      title: finalTitle,
      chatType: owned[0].chatType,
      createdAt: owned[0].createdAt,
      updatedAt: new Date(),
    };
    return toThreadView(row, inserted);
  });
}

export async function deleteConversation(userId: string, conversationId: string): Promise<boolean> {
  const deleted = await getDb()
    .delete(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .returning({ id: conversations.id });
  return deleted.length > 0;
}
