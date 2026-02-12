/**
 * Forex Advisor Chat API
 * 
 * Streaming endpoint for multi-agent forex pair analysis
 */

import { NextRequest, NextResponse } from "next/server";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { forexAdvisorGraph } from "@/lib/ai/forex-graph";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/forex-chat
 * Streaming forex analysis endpoint
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
    
    // Limit conversation history to prevent token limit errors
    // Keep last 6 messages (3 exchanges) to stay under token limits
    const truncatedMessages = messages.length > 6 
      ? messages.slice(-6)
      : messages;
    
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
          // Stream graph events
          const eventStream = await forexAdvisorGraph.stream(
            {
              messages: langchainMessages,
            },
            {
              streamMode: "values",
            }
          );
          
          // Process each event
          for await (const event of eventStream) {
            const nodeData = event as any;
            const messages = nodeData.messages || [];
            const lastMessage = messages[messages.length - 1];
            const next = nodeData.next;
            
            let agentStatus = null;
            let messageContent = "";
            
            if (lastMessage) {
              messageContent = typeof lastMessage.content === "string" 
                ? lastMessage.content 
                : JSON.stringify(lastMessage.content);
              
              // Parse routing messages
              if (messageContent.includes("[Routing to")) {
                const match = messageContent.match(/\[Routing to (\w+)\]/);
                if (match) {
                  agentStatus = {
                    agent: match[1],
                    status: "routing",
                    message: messageContent.replace(/\[Routing to \w+\]\s*/, ""),
                  };
                }
              }
            }
            
            // Check if final response
            const isFinalResponse = next === "__end__" || !next;
            
            // Send event to client
            const eventData = {
              type: isFinalResponse ? "final" : "agent",
              agent: agentStatus?.agent || next || "unknown",
              status: agentStatus?.status || "working",
              message: isFinalResponse ? messageContent : (agentStatus?.message || "Processing..."),
              data: nodeData.data || {},
              timestamp: new Date().toISOString(),
            };
            
            // Format as SSE
            const sseMessage = `data: ${JSON.stringify(eventData)}\n\n`;
            controller.enqueue(encoder.encode(sseMessage));
            
            // Close on final response
            if (isFinalResponse) {
              controller.close();
              return;
            }
          }
          
          controller.close();
        } catch (error) {
          console.error("[Forex API] Error in graph stream:", error);
          
          // Extract user-friendly error message
          let errorMessage = "An error occurred during forex analysis";
          
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
    console.error("[Forex API] Error in chat endpoint:", error);
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
