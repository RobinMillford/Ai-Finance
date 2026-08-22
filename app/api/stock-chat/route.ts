/**
 * Stock Advisor Chat API
 * 
 * Streaming endpoint for multi-agent stock analysis
 */

import { NextRequest, NextResponse } from "next/server";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { stockAdvisorGraph } from "@/lib/ai/stock-graph";
import { trimToTokenBudget } from "@/lib/ai/utils";
import { advisorStreamEvents } from "@/lib/ai/stream-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/stock-chat
 * Streaming stock analysis endpoint
 */
export async function POST(req: NextRequest) {
  try {
    // Check environment variables
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
    
    const truncatedMessages = trimToTokenBudget(messages);
    
    // Convert to LangChain messages
    const langchainMessages = truncatedMessages.map((msg: any) => {
      if (msg.role === "user") {
        return new HumanMessage(msg.content);
      } else if (msg.role === "assistant") {
        return new AIMessage(msg.content);
      }
      return new HumanMessage(msg.content);
    });
    
    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        try {
          // Stream graph events (plan → parallel workers → synthesis)
          for await (const ev of advisorStreamEvents(stockAdvisorGraph, {
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
          console.error("[Stock API] Error in graph stream:", error);
          
          // Extract user-friendly error message
          let errorMessage = "An error occurred during stock analysis";
          
          if (error instanceof Error) {
            if (error.message.includes("rate_limit_exceeded") || error.message.includes("413")) {
              errorMessage = "Rate limit exceeded. Please start a new chat or wait a moment before trying again.";
            } else if (error.message.includes("timeout")) {
              errorMessage = "Request timed out. Please try again with a simpler query.";
            } else {
              errorMessage = error.message;
            }
          }
          
          const errorEvent = {
            type: "error",
            error: errorMessage,
            timestamp: new Date().toISOString(),
          };
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
          controller.close();
        }
      },
    });
    
    // Return SSE stream
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("[Stock API] Error in chat endpoint:", error);
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
