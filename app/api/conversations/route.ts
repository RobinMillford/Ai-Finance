import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api-auth';
import {
  listConversations,
  createConversation,
} from '@/lib/db/repositories/conversations';
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
 * List the current user's conversations (newest first, without message
 * bodies — counts + last activity only; the thread loads on open).
 */
async function listConversationsRoute() {
  try {
    const userId = await requireUserId();
    if (!userId) {
      return errorResponse('Unauthorized', 401);
    }

    const conversations = await listConversations(userId);

    return NextResponse.json(conversations);
  } catch (error) {
    console.error('Error listing conversations:', error);
    return errorResponse('Failed to list conversations', 500);
  }
}

/**
 * POST /api/conversations
 * Create a conversation. Accepts an optional initial message.
 */
async function createConversationRoute(request: Request) {
  try {
    const userId = await requireUserId();
    if (!userId) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json().catch(() => ({}));
    const { title, chatType, firstMessage } = body;

    const validChatTypes = ['main', 'stock', 'forex'];
    const resolvedChatType = validChatTypes.includes(chatType) ? chatType : 'main';

    let first: { role: 'user' | 'assistant'; content: string } | undefined;
    if (firstMessage && typeof firstMessage.content === 'string' && firstMessage.content.trim()) {
      first = {
        role: firstMessage.role === 'assistant' ? 'assistant' : 'user',
        content: firstMessage.content.trim().slice(0, MAX_MESSAGE_LENGTH),
      };
    }

    const conversation = await createConversation(userId, {
      title: sanitizeTitle(title ?? firstMessage?.content),
      chatType: resolvedChatType,
      firstMessage: first,
    });

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return errorResponse('Failed to create conversation', 500);
  }
}

export const GET = withRateLimit(listConversationsRoute, RATE_LIMITS.API_DEFAULT);
export const POST = withRateLimit(createConversationRoute, RATE_LIMITS.API_DEFAULT);
