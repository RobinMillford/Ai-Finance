import { trimToTokenBudget, collectToolResults } from "../utils";

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
    // Each message is 40 chars → ~10 tokens; budget = 15 → only last message fits
    const a = msg("user", "a".repeat(40));
    const b = msg("assistant", "b".repeat(40));
    const c = msg("user", "c".repeat(40));
    const result = trimToTokenBudget([a, b, c], 15);
    expect(result).toEqual([c]);
  });

  it("keeps newest N messages that fit within budget", () => {
    // 8 chars → 2 tokens per message; budget 10 → last 5 messages fit
    const messages = Array.from({ length: 10 }, (_, i) =>
      msg("user", "12345678") // exactly 2 tokens each
    );
    const result = trimToTokenBudget(messages, 10);
    expect(result.length).toBe(5);
    expect(result).toEqual(messages.slice(5));
  });

  it("respects explicit budget parameter over env var", () => {
    const original = process.env.AI_HISTORY_TOKEN_BUDGET;
    process.env.AI_HISTORY_TOKEN_BUDGET = "9999";

    const a = msg("user", "a".repeat(40));  // ~10 tokens
    const b = msg("user", "b".repeat(40));  // ~10 tokens
    // explicit budget = 12 → only last message fits
    const result = trimToTokenBudget([a, b], 12);
    expect(result).toEqual([b]);

    process.env.AI_HISTORY_TOKEN_BUDGET = original ?? "";
  });

  it("uses AI_HISTORY_TOKEN_BUDGET env var when no explicit budget given", () => {
    const original = process.env.AI_HISTORY_TOKEN_BUDGET;
    process.env.AI_HISTORY_TOKEN_BUDGET = "12";

    const a = msg("user", "a".repeat(40));  // ~10 tokens
    const b = msg("user", "b".repeat(40));  // ~10 tokens
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

  it("last write wins when multiple tool messages share a name", () => {
    const messages = [
      makeToolMessage("prices", JSON.stringify({ BTC: 50000 })),
      makeToolMessage("prices", JSON.stringify({ BTC: 60000 })),
    ];
    expect(collectToolResults(messages)).toEqual({ prices: { BTC: 60000 } });
  });
});
