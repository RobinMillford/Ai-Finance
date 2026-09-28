import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import Conversation, { ConversationRole } from '@/models/Conversation';
import { withRateLimit, errorResponse } from '@/lib/api-middleware';
import { RATE_LIMITS } from '@/lib/rate-limiter';

const MAX_TITLE_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 32_000;

function sanitizeTitle(raw: unknown): string {
  const title = typeof raw === 'string' ? raw.trim().slice(0, MAX_TITLE_LENGTH) : '';
  return title || 'New conversation';
}

/**
 * GET /api/conversations
 * List the current user's conversations (newest first, without messages —
 * the thread is loaded per conversation on open).
 */
async function listConversations() {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return errorResponse('Unauthorized', 401);
    }

    await dbConnect();
    const conversations = await Conversation.find({ userId: session.user.email })
      .select('title chatType createdAt updatedAt messages')
      .sort({ createdAt: -1 })
      .lean();

    // Derive counts + preview without shipping full message bodies.
    return NextResponse.json(
      conversations.map((c) => ({
        _id: c._id,
        title: c.title,
        chatType: c.chatType,
        messageCount: c.messages?.length ?? 0,
        lastMessageAt: c.messages?.length
          ? c.messages[c.messages.length - 1].createdAt
          : c.createdAt,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }))
    );
  } catch (error) {
    console.error('Error listing conversations:', error);
    return errorResponse('Failed to list conversations', 500);
  }
}

/**
 * POST /api/conversations
 * Create a conversation. Accepts an optional initial message.
 */
async function createConversation(request: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json().catch(() => ({}));
    const { title, chatType, firstMessage } = body;

    const validChatTypes = ['main', 'stock', 'forex'];
    const resolvedChatType = validChatTypes.includes(chatType) ? chatType : 'main';

    await dbConnect();

    const messages: {
      role: ConversationRole;
      content: string;
      createdAt: Date;
    }[] = [];

    if (firstMessage && typeof firstMessage.content === 'string' && firstMessage.content.trim()) {
      messages.push({
        role: firstMessage.role === 'assistant' ? 'assistant' : 'user',
        content: firstMessage.content.trim().slice(0, MAX_MESSAGE_LENGTH),
        createdAt: new Date(),
      });
    }

    const conversation = await Conversation.create({
      userId: session.user.email,
      title: sanitizeTitle(title ?? firstMessage?.content),
      chatType: resolvedChatType,
      messages,
    });

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return errorResponse('Failed to create conversation', 500);
  }
}

export const GET = withRateLimit(listConversations, RATE_LIMITS.API_DEFAULT);
export const POST = withRateLimit(createConversation, RATE_LIMITS.API_DEFAULT);
