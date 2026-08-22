/**
 * Crypto Advisor Chat API
 * 
 * Streaming endpoint for multi-agent cryptocurrency analysis
 * Uses LangGraph to orchestrate specialized agents
 */

import { NextRequest, NextResponse } from "next/server";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { cryptoAdvisorGraph } from "@/lib/ai/graph";
import { trimToTokenBudget } from "@/lib/ai/utils";
import { advisorStreamEvents } from "@/lib/ai/stream-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60 seconds for complex analysis

/**
 * POST /api/chat
 * Accepts a conversation history and streams back agent events
 */
export async function POST(req: NextRequest) {
  try {
    // Check for required environment variables
    if (!process.env.NEXT_PUBLIC_GROQ_API_KEY) {
      return NextResponse.json(
        { 
          error: "Server configuration error: NEXT_PUBLIC_GROQ_API_KEY not set",
          details: "Please set the NEXT_PUBLIC_GROQ_API_KEY environment variable in .env.local"
        },
        { status: 500 }
      );
    }
    
    const { messages } = await req.json();
    
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid request: messages array required" },
        { status: 400 }
      );
    }
    
    // Trim history to token budget (default 4000 tokens, ~16 KB of text).
    // Keeps the newest messages and always retains at least the current query.
    const truncatedMessages = trimToTokenBudget(messages);
    
    // Convert plain message objects to LangChain message instances
    const langchainMessages = truncatedMessages.map((msg: any) => {
      if (msg.role === "user") {
        return new HumanMessage(msg.content);
      } else if (msg.role === "assistant") {
        return new AIMessage(msg.content);
      }
      return new HumanMessage(msg.content); // fallback
    });
    
    // Create a readable stream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        try {
          // Stream graph events (plan → parallel workers → synthesis)
          for await (const ev of advisorStreamEvents(cryptoAdvisorGraph, {
            messages: langchainMessages,
          })) {
            const eventData = ev;
            const sseMessage = `data: ${JSON.stringify(eventData)}\n\n`;
            controller.enqueue(encoder.encode(sseMessage));

            // Close on final response
            if (ev.type === "final") {
              controller.close();
              return;
            }
          }
          
          controller.close();
        } catch (error) {
          console.error("[API] Error in graph stream:", error);
          
          // Send error event
          const errorEvent = {
            type: "error",
            error: error instanceof Error ? error.message : "An error occurred during analysis",
            timestamp: new Date().toISOString(),
          };
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
          controller.close();
        }
      },
    });
    
    // Return the stream with SSE headers
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no", // Disable nginx buffering
      },
    });
  } catch (error) {
    console.error("[API] Error in chat endpoint:", error);
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
