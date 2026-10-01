import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api-auth';
import {
  getConversationThread,
  appendMessage,
  deleteConversation,
} from '@/lib/db/repositories/conversations';
import { withRateLimit, errorResponse } from '@/lib/api-middleware';
import { RATE_LIMITS } from '@/lib/rate-limiter';

const MAX_MESSAGE_LENGTH = 32_000;
const MAX_TITLE_CHARS = 200;

/**
 * GET /api/conversations/[id]
 * Load one conversation (full thread). Owner-only.
 */
async function getConversation(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    if (!userId) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;

    const conversation = await getConversationThread(userId, id);

    if (!conversation) {
      return errorResponse('Conversation not found', 404);
    }

    return NextResponse.json(conversation);
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return errorResponse('Failed to fetch conversation', 500);
  }
}

/**
 * POST /api/conversations/[id]
 * Append a message (user reply or assistant answer). The first user message
 * on an untitled conversation renames it atomically inside the repository.
 */
async function appendMessageRoute(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    if (!userId) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { role, content, provider, agent } = body;

    if (!['user', 'assistant', 'system'].includes(role)) {
      return errorResponse('Invalid message role', 400);
    }
    if (typeof content !== 'string' || !content.trim()) {
      return errorResponse('Message content is required', 400);
    }

    const conversation = await appendMessage(userId, id, {
      role,
      content: content.trim().slice(0, MAX_MESSAGE_LENGTH),
      provider: typeof provider === 'string' ? provider.slice(0, 100) : undefined,
      agent: typeof agent === 'string' ? agent.slice(0, 100) : undefined,
      retitleIfUntitled:
        role === 'user' ? content.trim().slice(0, MAX_TITLE_CHARS) : undefined,
    });

    if (!conversation) {
      return errorResponse('Conversation not found', 404);
    }

    return NextResponse.json(conversation);
  } catch (error) {
    console.error('Error appending message:', error);
    return errorResponse('Failed to append message', 500);
  }
}

/**
 * DELETE /api/conversations/[id]
 * Delete a conversation. Owner-only.
 */
async function deleteConversationRoute(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    if (!userId) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;

    const deleted = await deleteConversation(userId, id);

    if (!deleted) {
      return errorResponse('Conversation not found', 404);
    }

    return NextResponse.json({ message: 'Conversation deleted successfully' });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return errorResponse('Failed to delete conversation', 500);
  }
}

export const GET = withRateLimit(getConversation, RATE_LIMITS.API_DEFAULT);
export const POST = withRateLimit(appendMessageRoute, RATE_LIMITS.API_DEFAULT);
export const DELETE = withRateLimit(deleteConversationRoute, RATE_LIMITS.API_DEFAULT);
