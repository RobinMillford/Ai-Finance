import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import Conversation from '@/models/Conversation';
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
    const session = await getServerSession();
    if (!session?.user?.email) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;
    await dbConnect();

    const conversation = await Conversation.findOne({
      _id: id,
      userId: session.user.email,
    }).lean();

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
 * Append a message (user reply or assistant answer).
 */
async function appendMessage(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
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

    const message: Record<string, unknown> = {
      role,
      content: content.trim().slice(0, MAX_MESSAGE_LENGTH),
      createdAt: new Date(),
    };
    if (typeof provider === 'string') message.provider = provider.slice(0, 100);
    if (typeof agent === 'string') message.agent = agent.slice(0, 100);

    await dbConnect();

    // Load enough to decide whether the title should be auto-derived from the
    // first user message (conversations created without a title).
    const existing = await Conversation.findOne(
      { _id: id, userId: session.user.email },
      { title: 1, messages: { $slice: 1 } }
    ).lean();

    if (!existing) {
      return errorResponse('Conversation not found', 404);
    }

    const shouldRetitle =
      role === 'user' &&
      (existing.messages?.length ?? 0) === 0 &&
      (existing.title === 'New conversation' || !existing.title);

    const conversation = await Conversation.findOneAndUpdate(
      { _id: id, userId: session.user.email },
      {
        $push: { messages: message },
        ...(shouldRetitle
          ? { $set: { title: content.trim().slice(0, MAX_TITLE_CHARS) } }
          : {}),
      },
      { new: true }
    );

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
async function deleteConversation(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;
    await dbConnect();

    const conversation = await Conversation.findOneAndDelete({
      _id: id,
      userId: session.user.email,
    });

    if (!conversation) {
      return errorResponse('Conversation not found', 404);
    }

    return NextResponse.json({ message: 'Conversation deleted successfully' });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return errorResponse('Failed to delete conversation', 500);
  }
}

export const GET = withRateLimit(getConversation, RATE_LIMITS.API_DEFAULT);
export const POST = withRateLimit(appendMessage, RATE_LIMITS.API_DEFAULT);
export const DELETE = withRateLimit(deleteConversation, RATE_LIMITS.API_DEFAULT);
