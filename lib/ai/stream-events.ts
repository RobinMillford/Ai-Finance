/**
 * Advisor graph → SSE event adapter
 *
 * Converts a compiled advisor graph's update-mode stream into the
 * SSE event contract consumed by the advisor pages:
 *   { type: "agent" | "final", agent, status, message, data, timestamp }
 *
 * Replaces the old values-stream + state.next detection, which broke when the
 * graph moved to plan-once / parallel-dispatch architecture.
 */

export interface AdvisorStreamEvent {
  type: "agent" | "final";
  agent: string;
  status: string;
  message: string;
  data: Record<string, unknown>;
  timestamp: string;
}

const WORKER_STATUS_MESSAGES: Record<string, string> = {
  TechnicalAnalyst: "Analyzing price and technical indicators...",
  SentimentAnalyst: "Analyzing social sentiment...",
  MarketResearcher: "Researching market intelligence...",
};

const KNOWN_NODES = new Set([
  "supervisor",
  ...Object.keys(WORKER_STATUS_MESSAGES),
  "finalResponse",
]);

function textContent(content: unknown): string {
  return typeof content === "string" ? content : JSON.stringify(content);
}

/**
 * Stream a compiled advisor graph and yield normalized SSE events.
 */
export async function* advisorStreamEvents(
  // Loose typing: LangGraph's CompiledStateGraph.stream carries heavy generics
  // that vary per compiled graph; runtime contract is (input, config) → async
  // iterable of update chunks.
  graph: { stream: (...args: any[]) => Promise<AsyncIterable<unknown>> },
  input: unknown
): AsyncGenerator<AdvisorStreamEvent> {
  const eventStream = await graph.stream(input, {
    streamMode: "updates",
  });

  for await (const chunk of eventStream) {
    if (!chunk || typeof chunk !== "object") continue;
    // Updates chunks map node name → node output. Parallel dispatch produces
    // several node entries in one chunk.
    for (const [node, update] of Object.entries(chunk as Record<string, any>)) {
      if (!KNOWN_NODES.has(node)) continue;
      const timestamp = new Date().toISOString();
      const output = update ?? {};
      const data = (output.data ?? {}) as Record<string, unknown>;

      if (node === "supervisor") {
        const raw = textContent(output.messages?.[0]?.content ?? "");
        yield {
          type: "agent",
          agent: "Supervisor",
          status: "routing",
          message: raw.replace(/^\[Plan:[^\]]*\]\s*/, "") || "Planning analysis...",
          data,
          timestamp,
        };
      } else if (node === "finalResponse") {
        yield {
          type: "final",
          agent: "Supervisor",
          status: "complete",
          message: textContent(output.messages?.at(-1)?.content ?? ""),
          data,
          timestamp,
        };
      } else {
        yield {
          type: "agent",
          agent: node,
          status: "working",
          message: WORKER_STATUS_MESSAGES[node],
          data,
          timestamp,
        };
      }
    }
  }
}
