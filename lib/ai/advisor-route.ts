/**
 * Shared advisor chat route handler (Phase 0).
 *
 * Single implementation of the SSE streaming endpoint that was previously
 * copy-pasted three times (`/api/chat`, `/api/stock-chat`, `/api/forex-chat`).
 * Adds Phase 0 protections that the duplicated routes lacked:
 *  - session authentication (AI calls consume paid quota)
 *  - AI rate limiting (RATE_LIMITS.AI_ENDPOINTS existed but was never wired)
 *  - strict request validation with bounded message sizes
 *  - bounded synthesis payloads via boundDataPayload
 *  - consistent, non-leaking error semantics
 *
 * The graph, plan normalization, retry helpers, and SSE event contract are
 * unchanged (Phase 0 rule: preserve the AI architecture).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { trimToTokenBudget } from '@/lib/ai/utils';
import { advisorStreamEvents } from '@/lib/ai/stream-events';
import { validateChatRequest, ValidatedChatMessage } from '@/lib/ai/request-validation';
import { rateLimiter, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limiter';
import { env } from '@/lib/env';
// Type-only import: LangGraph's version-sensitive generics are erased here, so
// `any` keeps this route shim decoupled from the graph internals it must not
// redesign (Phase 0 rule: preserve the AI architecture).
import type { CompiledStateGraph } from '@langchain/langgraph';

const ERROR_PREFIXES: Record<string, string> = {
  rate_limit_exceeded: 'Rate limit exceeded. Please wait a moment before trying again.',
  '413': 'Request too large. Please start a new chat or shorten your message.',
};

function friendlyError(message: string): string {
  if (message.includes('rate_limit_exceeded') || message.includes('429')) {
    return ERROR_PREFIXES.rate_limit_exceeded;
  }
  if (message.includes('413') || message.toLowerCase().includes('request too large')) {
    return ERROR_PREFIXES['413'];
  }
  if (message.toLowerCase().includes('timeout')) {
    return 'Request timed out. Please try again with a simpler query.';
  }
  // Never surface raw provider/internals to the client.
  return 'An error occurred during analysis. Please try again.';
}

function sseError(controller: ReadableStreamDefaultController, encoder: TextEncoder, message: string) {
  const errorEvent = {
    type: 'error',
    error: message,
    timestamp: new Date().toISOString(),
  };
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
  controller.close();
}

/**
 * Build the POST handler for an advisor chat endpoint.
 * `logPrefix` keeps existing log conventions (e.g. "[Stock API]").
 */
export function createAdvisorChatHandler(
  graph: CompiledStateGraph<any, any, any, any, any>,
  logPrefix: string
) {
  return async function POST(req: NextRequest) {
    // 1. Authentication — advisor runs consume Groq quota.
    const session = await getServerSession(authOptions);
    if (!session?.user?.id && !session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Rate limiting per client identity (per-instance limiter — documented
    //    Phase 0 limitation; see lib/rate-limiter.ts).
    const clientId = getClientIdentifier(req);
    const rl = RATE_LIMITS.AI_ENDPOINTS;
    if (rateLimiter.isRateLimited(`ai:${clientId}`, rl.limit, rl.windowMs)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before trying again.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    // 3. Server configuration check.
    if (!env.groq.apiKey || env.groq.apiKey.includes('dummy')) {
      return NextResponse.json(
        { error: 'Server configuration error: AI provider is not configured' },
        { status: 500 }
      );
    }

    // 4. Strict input validation (never trust the browser).
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const validation = validateChatRequest(body);
    if (!validation.ok || !validation.messages) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const messages: ValidatedChatMessage[] = validation.messages;

    // 5. Trim to token budget (existing behavior preserved), then convert.
    const truncated = trimToTokenBudget(messages);
    const langchainMessages = truncated.map((msg) =>
      msg.role === 'assistant' ? new AIMessage(msg.content) : new HumanMessage(msg.content)
    );

    // 6. Stream graph events as SSE (Phase 1: + true token streaming).
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let controllerClosed = false;
        let tokenQueue: Promise<void> = Promise.resolve();
        try {
          for await (const ev of advisorStreamEvents(
            graph,
            { messages: langchainMessages },
            {
              // True token streaming (§37): synthesis tokens are forwarded to
              // the client as they are generated. Emission is synchronized via
              // a promise chain so SSE frame order is preserved under
              // backpressure. `final` still carries the complete message, so
              // older clients stay correct.
              onFinalToken: (token) => {
                tokenQueue = tokenQueue.then(() =>
                  Promise.resolve().then(() => {
                    if (controllerClosed) return;
                    try {
                      controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ type: 'token', token })}\n\n`)
                      );
                    } catch {
                      controllerClosed = true; // stream already errored/closed
                    }
                  })
                );
              },
            }
          )) {
            if (controllerClosed) break;
            tokenQueue = tokenQueue.then(() => {
              if (controllerClosed) return;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
            });
            await tokenQueue;
            if (ev.type === 'final') {
              controllerClosed = true;
              controller.close();
              return;
            }
          }
          controllerClosed = true;
          controller.close();
        } catch (error) {
          console.error(`[${logPrefix}] Error in graph stream:`, error);
          sseError(
            controller,
            encoder,
            error instanceof Error ? friendlyError(error.message) : 'An error occurred during analysis'
          );
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  };
}
