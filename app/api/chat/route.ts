/**
 * Crypto Advisor Chat API
 * 
 * Streaming endpoint for multi-agent cryptocurrency analysis
 * Uses LangGraph to orchestrate specialized agents
 */

import { NextRequest, NextResponse } from "next/server";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { cryptoAdvisorGraph } from "@/lib/ai/graph";

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
    
    // Limit conversation history to prevent token limit errors
    // Keep last 6 messages (3 exchanges) to stay under token limits
    const truncatedMessages = messages.length > 6 
      ? messages.slice(-6)
      : messages;
    
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
          // Stream graph events as they occur
          const eventStream = await cryptoAdvisorGraph.stream(
            {
              messages: langchainMessages,
            },
            {
              streamMode: "values",
            }
          );
          
          // Process each event from the graph
          for await (const event of eventStream) {
            // Extract the current node being executed
            const nodeData = event as any;
            const messages = nodeData.messages || [];
            const lastMessage = messages[messages.length - 1];
            const next = nodeData.next;
            
            // Determine which agent is active
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
              } else if (messageContent.includes("Technical Analyst")) {
                agentStatus = {
                  agent: "TechnicalAnalyst",
                  status: "working",
                  message: "Analyzing price and technical indicators...",
                };
              } else if (messageContent.includes("Sentiment Analyst")) {
                agentStatus = {
                  agent: "SentimentAnalyst",
                  status: "working",
                  message: "Analyzing social sentiment...",
                };
              } else if (messageContent.includes("Market Researcher")) {
                agentStatus = {
                  agent: "MarketResearcher",
                  status: "working",
                  message: "Researching market intelligence...",
                };
              }
            }
            
            // Check if this is the final response
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
            
            // If this is the final response, close the stream
            if (isFinalResponse) {
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
