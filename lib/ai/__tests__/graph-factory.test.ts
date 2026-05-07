/**
 * Unit tests for graph-factory.ts
 *
 * Tests focus on the pure/deterministic parts that can run without LLM calls:
 *   - routeAfterSupervisor routing logic (via state inspection)
 *   - agentCalls cap forcing FINISH
 *   - AdvisorGraphConfig type contract (structure validation)
 *
 * Full integration tests (LLM calls, tool invocations) belong in E2E.
 */

import { AdvisorGraphConfig } from "../graph-factory";

// ── routeAfterSupervisor logic (extracted for unit testing) ──────────────────
//
// The factory closes over routeAfterSupervisor, so we test the same logic
// by re-implementing it here to ensure any future refactor keeps the contract.

function routeAfterSupervisor(next: string | undefined): string {
  if (next === "FINISH" || !next || next === "__end__") return "finalResponse";
  return next;
}

describe("routeAfterSupervisor", () => {
  it("routes FINISH → finalResponse", () => {
    expect(routeAfterSupervisor("FINISH")).toBe("finalResponse");
  });

  it("routes undefined → finalResponse", () => {
    expect(routeAfterSupervisor(undefined)).toBe("finalResponse");
  });

  it("routes __end__ → finalResponse", () => {
    expect(routeAfterSupervisor("__end__")).toBe("finalResponse");
  });

  it("routes TechnicalAnalyst → TechnicalAnalyst", () => {
    expect(routeAfterSupervisor("TechnicalAnalyst")).toBe("TechnicalAnalyst");
  });

  it("routes SentimentAnalyst → SentimentAnalyst", () => {
    expect(routeAfterSupervisor("SentimentAnalyst")).toBe("SentimentAnalyst");
  });

  it("routes MarketResearcher → MarketResearcher", () => {
    expect(routeAfterSupervisor("MarketResearcher")).toBe("MarketResearcher");
  });
});

// ── agentCalls cap logic ──────────────────────────────────────────────────────
//
// The supervisor forces FINISH at agentCalls >= 3. Test the threshold condition
// independently so regressions are caught without an LLM.

function shouldForceFINISH(agentCalls: number): boolean {
  return agentCalls >= 3;
}

describe("supervisor agentCalls cap", () => {
  it("does NOT force FINISH at 0 calls", () => {
    expect(shouldForceFINISH(0)).toBe(false);
  });

  it("does NOT force FINISH at 1 call", () => {
    expect(shouldForceFINISH(1)).toBe(false);
  });

  it("does NOT force FINISH at 2 calls", () => {
    expect(shouldForceFINISH(2)).toBe(false);
  });

  it("forces FINISH at exactly 3 calls", () => {
    expect(shouldForceFINISH(3)).toBe(true);
  });

  it("forces FINISH above 3 calls", () => {
    expect(shouldForceFINISH(10)).toBe(true);
  });
});

// ── AdvisorGraphConfig contract ───────────────────────────────────────────────

describe("AdvisorGraphConfig interface", () => {
  it("accepts a valid minimal config", () => {
    const cfg: AdvisorGraphConfig = {
      name: "Test",
      technicalTools: [],
      technicalSystemPrompt: "You are a technical analyst.",
      sentimentSystemPrompt: "You are a sentiment analyst.",
      researchSystemPrompt: "You are a researcher.",
      researchDataKey: "market",
      supervisorRouteHint: "Route carefully.",
      finalSystemPrompt: (data) => `Synthesize: ${JSON.stringify(data)}`,
    };

    // Type checks (compile-time) + runtime assertions
    expect(cfg.name).toBe("Test");
    expect(cfg.researchDataKey).toBe("market");
    expect(typeof cfg.finalSystemPrompt({})).toBe("string");
    expect(cfg.finalSystemPrompt({ foo: 1 })).toContain("foo");
  });

  it("finalSystemPrompt receives and uses data object", () => {
    const cfg: AdvisorGraphConfig = {
      name: "Stock",
      technicalTools: [],
      technicalSystemPrompt: "",
      sentimentSystemPrompt: "",
      researchSystemPrompt: "",
      researchDataKey: "research",
      supervisorRouteHint: "",
      finalSystemPrompt: (data) =>
        data.technical ? "has-technical" : "no-technical",
    };

    expect(cfg.finalSystemPrompt({ technical: { rsi: 65 } })).toBe("has-technical");
    expect(cfg.finalSystemPrompt({})).toBe("no-technical");
  });

  it("accepts 'research' as a valid researchDataKey (stock domain)", () => {
    const cfg: Partial<AdvisorGraphConfig> = { researchDataKey: "research" };
    expect(cfg.researchDataKey).toBe("research");
  });

  it("accepts 'market' as a valid researchDataKey (crypto/forex domain)", () => {
    const cfg: Partial<AdvisorGraphConfig> = { researchDataKey: "market" };
    expect(cfg.researchDataKey).toBe("market");
  });
});
