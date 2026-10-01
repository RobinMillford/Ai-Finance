/**
 * Stock Advisor Chat API
 *
 * Streaming endpoint for multi-agent stock analysis.
 * Phase 0: shared handler adds authentication, AI rate limiting, and strict
 * input validation (previously unauthenticated and unlimited).
 */

import { createAdvisorChatHandler } from '@/lib/ai/advisor-route';
import { stockAdvisorGraph } from '@/lib/ai/stock-graph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const POST = createAdvisorChatHandler(stockAdvisorGraph, 'Stock API');
