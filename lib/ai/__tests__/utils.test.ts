import {
  trimToTokenBudget,
  collectToolResults,
  withRetry,
  isTransientError,
} from "../utils";

// ── trimToTokenBudget ─────────────────────────────────────────────────────────

describe("trimToTokenBudget", () => {
  const msg = (role: string, content: string) => ({ role, content });

  it("returns empty array unchanged", () => {
    expect(trimToTokenBudget([])).toEqual([]);
  });

  it("keeps all messages when under budget", () => {
    const messages = [msg("user", "hi"), msg("assistant", "hello")];
    // 2 + 5 = 7 chars → ~2 tokens each; budget 4000 → all kept
    expect(trimToTokenBudget(messages, 4000)).toEqual(messages);
  });

  it("always keeps the last message even if it alone exceeds budget", () => {
    const big = msg("user", "x".repeat(400)); // ~100 tokens
    const result = trimToTokenBudget([big], 10);
    expect(result).toEqual([big]);
  });

  it("drops oldest messages when budget is tight", () => {
    // "hello world" = exactly 2 tokens; budget = 5 → only last 2 messages fit
    const a = msg("user", "hello world");
    const b = msg("assistant", "hello world");
    const c = msg("user", "hello world");
    const result = trimToTokenBudget([a, b, c], 5);
    expect(result).toEqual([b, c]);
  });

  it("keeps newest N messages that fit within budget", () => {
    // "hello world" = exactly 2 tokens per message; budget 10 → last 5 fit
    const messages = Array.from({ length: 10 }, () =>
      msg("user", "hello world")
    );
    const result = trimToTokenBudget(messages, 10);
    expect(result.length).toBe(5);
    expect(result).toEqual(messages.slice(5));
  });

  it("respects explicit budget parameter over env var", () => {
    const original = process.env.AI_HISTORY_TOKEN_BUDGET;
    process.env.AI_HISTORY_TOKEN_BUDGET = "9999";

    const a = msg("user", "hello world");  // 2 tokens
    const b = msg("user", "hello world");  // 2 tokens
    // explicit budget = 3 → only last message fits
    const result = trimToTokenBudget([a, b], 3);
    expect(result).toEqual([b]);

    process.env.AI_HISTORY_TOKEN_BUDGET = original ?? "";
  });

  it("uses AI_HISTORY_TOKEN_BUDGET env var when no explicit budget given", () => {
    const original = process.env.AI_HISTORY_TOKEN_BUDGET;
    process.env.AI_HISTORY_TOKEN_BUDGET = "3";

    const a = msg("user", "hello world");  // 2 tokens
    const b = msg("user", "hello world");  // 2 tokens
    const result = trimToTokenBudget([a, b]);
    expect(result).toEqual([b]);

    process.env.AI_HISTORY_TOKEN_BUDGET = original ?? "";
  });

  it("preserves message order (oldest first) in result", () => {
    const messages = [
      msg("user", "first"),
      msg("assistant", "second"),
      msg("user", "third"),
    ];
    const result = trimToTokenBudget(messages, 4000);
    expect(result.map((m) => m.content)).toEqual(["first", "second", "third"]);
  });
});

// ── collectToolResults ────────────────────────────────────────────────────────

describe("collectToolResults", () => {
  function makeToolMessage(name: string, content: string) {
    // Minimal BaseMessage-compatible mock
    return {
      _getType: () => "tool" as const,
      content,
      name,
    } as any;
  }

  function makeAIMessage(content: string) {
    return {
      _getType: () => "ai" as const,
      content,
    } as any;
  }

  it("returns empty object for empty array", () => {
    expect(collectToolResults([])).toEqual({});
  });

  it("ignores non-tool messages", () => {
    const messages = [makeAIMessage("some AI reply")];
    expect(collectToolResults(messages)).toEqual({});
  });

  it("parses JSON tool result into data object", () => {
    const msg = makeToolMessage("getPrices", JSON.stringify({ BTC: 60000 }));
    expect(collectToolResults([msg])).toEqual({ getPrices: { BTC: 60000 } });
  });

  it("stores raw string if content is not valid JSON", () => {
    const msg = makeToolMessage("getSentiment", "bullish");
    expect(collectToolResults([msg])).toEqual({ getSentiment: "bullish" });
  });

  it("collects multiple tool results under their names", () => {
    const messages = [
      makeAIMessage("AI message — ignored"),
      makeToolMessage("technical", JSON.stringify({ rsi: 65 })),
      makeToolMessage("sentiment", JSON.stringify({ score: 0.8 })),
    ];
    expect(collectToolResults(messages)).toEqual({
      technical: { rsi: 65 },
      sentiment: { score: 0.8 },
    });
  });

  it("uses 'unknown' key when tool message has no name", () => {
    const msg = {
      _getType: () => "tool" as const,
      content: JSON.stringify({ val: 1 }),
    } as any;
    expect(collectToolResults([msg])).toEqual({ unknown: { val: 1 } });
  });

  it("aggregates repeated tool calls into an array (no data loss)", () => {
    const messages = [
      makeToolMessage("prices", JSON.stringify({ BTC: 50000 })),
      makeToolMessage("prices", JSON.stringify({ BTC: 60000 })),
    ];
    expect(collectToolResults(messages)).toEqual({
      prices: [{ BTC: 50000 }, { BTC: 60000 }],
    });
  });

  it("aggregates three or more repeated tool calls into an array", () => {
    const messages = [
      makeToolMessage("prices", JSON.stringify({ BTC: 50000 })),
      makeToolMessage("prices", JSON.stringify({ BTC: 60000 })),
      makeToolMessage("prices", "raw text"),
    ];
    expect(collectToolResults(messages)).toEqual({
      prices: [{ BTC: 50000 }, { BTC: 60000 }, "raw text"],
    });
  });
});

// ── withRetry / isTransientError ──────────────────────────────────────────────

describe("isTransientError", () => {
  it.each([
    ["429 Too Many Requests", true],
    ["rate_limit_exceeded", true],
    ["503 Service Unavailable", true],
    ["Request timeout", true],
    ["fetch failed", true],
    ["model overloaded", true],
    ["Invalid API Key", false],
    ["invalid_request_error", false],
    ["413 Request too large for model", false],
    ["request too large: reduce message size", false],
  ])("%s → %s", (message, expected) => {
    expect(isTransientError(new Error(message))).toBe(expected);
  });

  it("returns false for non-Error values", () => {
    expect(isTransientError("429")).toBe(false);
    expect(isTransientError(null)).toBe(false);
  });
});

describe("withRetry", () => {
  it("returns value on first success", async () => {
    const result = await withRetry(async () => "ok", 2, 1);
    expect(result).toBe("ok");
  });

  it("retries transient errors and succeeds", async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts++;
        if (attempts < 3) throw new Error("429 rate_limit_exceeded");
        return "recovered";
      },
      2,
      1
    );
    expect(result).toBe("recovered");
    expect(attempts).toBe(3);
  });

  it("throws immediately on non-transient error", async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts++;
          throw new Error("Invalid API Key");
        },
        2,
        1
      )
    ).rejects.toThrow("Invalid API Key");
    expect(attempts).toBe(1);
  });

  it("throws after exhausting retries on persistent transient errors", async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts++;
          throw new Error("503 overloaded");
        },
        2,
        1
      )
    ).rejects.toThrow("503 overloaded");
    expect(attempts).toBe(3); // initial + 2 retries
  });
});
