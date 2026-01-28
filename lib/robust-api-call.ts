/**
 * Robust API call utility with timeout, retry, and streaming support
 */

export interface RobustApiOptions {
  endpoint: string;
  messages: Array<{ role: string; content: string }>;
  onAgentUpdate?: (agent: string, status: string, message: string) => void;
  onStream?: (chunk: string) => void;
  onComplete?: (response: string) => void;
  onError?: (error: Error) => void;
  timeout?: number;
  maxRetries?: number;
  signal?: AbortSignal;
}

export interface AgentStep {
  agent: string;
  status: string;
  message: string;
  timestamp: string;
}

export async function robustApiCall(options: RobustApiOptions): Promise<{
  response: string;
  steps: AgentStep[];
}> {
  const {
    endpoint,
    messages,
    onAgentUpdate,
    onStream,
    onComplete,
    onError,
    timeout = 60000,
    maxRetries = 2,
    signal,
  } = options;

  const steps: AgentStep[] = [];
  let retries = 0;

  while (retries <= maxRetries) {
    try {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), timeout);

      // Combine external signal with internal timeout
      const combinedSignal = signal
        ? combineSignals([signal, abortController.signal])
        : abortController.signal;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages }),
        signal: combinedSignal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(
          errorData.details
            ? `${errorData.error}: ${errorData.details}`
            : `API error: ${response.status}`
        );
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let finalResponse = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === "agent") {
                  if (data.agent === "unknown") continue;

                  const step: AgentStep = {
                    agent: data.agent,
                    status: data.status,
                    message: data.message,
                    timestamp: new Date().toLocaleTimeString(),
                  };
                  steps.push(step);

                  onAgentUpdate?.(data.agent, data.status, data.message);
                } else if (data.type === "final") {
                  finalResponse = data.message;
                  onStream?.(finalResponse);
                  onComplete?.(finalResponse);
                } else if (data.type === "stream") {
                  finalResponse += data.chunk;
                  onStream?.(finalResponse);
                } else if (data.type === "error") {
                  throw new Error(data.error);
                }
              } catch (parseError) {
                console.warn("Failed to parse SSE data:", line);
              }
            }
          }
        }
      }

      clearTimeout(timeoutId);
      return { response: finalResponse || "Analysis complete.", steps };
    } catch (error: any) {
      if (error.name === "AbortError") {
        const timeoutError = new Error("Request timeout: The analysis took too long. Please try a simpler query.");
        onError?.(timeoutError);
        throw timeoutError;
      }

      retries++;
      if (retries <= maxRetries) {
        console.log(`Retrying... (${retries}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * retries));
        continue;
      }

      onError?.(error);
      throw error;
    }
  }

  throw new Error("Max retries exceeded");
}

function combineSignals(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  return controller.signal;
}
