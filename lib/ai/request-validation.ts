/**
 * Chat request validation (Phase 0).
 *
 * Server-side contract for the advisor chat endpoints. The browser is never
 * trusted: roles are whitelisted, sizes are bounded, and history length is
 * capped before anything reaches the graph. Preserves the existing
 * token-budget trimming behavior (applied afterwards by the route).
 */

export interface ValidatedChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ValidationResult {
  ok: boolean;
  messages?: ValidatedChatMessage[];
  error?: string;
}

const MAX_MESSAGES = 30;
const MAX_MESSAGE_CHARS = 4000;
const MAX_TOTAL_CHARS = 20_000;

/**
 * Validate the `{ messages: [...] }` chat request body.
 * Returns a discriminated result; on success `messages` contains a
 * normalized copy safe to pass to the graph.
 */
export function validateChatRequest(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object' };
  }
  const { messages } = body as { messages?: unknown };

  if (!Array.isArray(messages)) {
    return { ok: false, error: 'Invalid request: messages array required' };
  }
  if (messages.length === 0) {
    return { ok: false, error: 'Invalid request: at least one message required' };
  }
  if (messages.length > MAX_MESSAGES) {
    return { ok: false, error: `Too many messages (max ${MAX_MESSAGES})` };
  }

  const validated: ValidatedChatMessage[] = [];
  let totalChars = 0;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg || typeof msg !== 'object') {
      return { ok: false, error: `Message ${i} must be an object` };
    }
    const { role, content } = msg as { role?: unknown; content?: unknown };

    if (role !== 'user' && role !== 'assistant') {
      return { ok: false, error: `Message ${i} has invalid role` };
    }
    if (typeof content !== 'string') {
      return { ok: false, error: `Message ${i} content must be a string` };
    }
    const trimmed = content.trim();
    if (trimmed.length === 0) {
      return { ok: false, error: `Message ${i} content cannot be empty` };
    }
    if (trimmed.length > MAX_MESSAGE_CHARS) {
      return { ok: false, error: `Message ${i} exceeds max length of ${MAX_MESSAGE_CHARS} characters` };
    }
    totalChars += trimmed.length;
    if (totalChars > MAX_TOTAL_CHARS) {
      return { ok: false, error: `Conversation exceeds max size of ${MAX_TOTAL_CHARS} characters` };
    }
    validated.push({ role, content: trimmed });
  }

  return { ok: true, messages: validated };
}
