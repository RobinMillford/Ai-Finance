/**
 * Phase 0 tests: chat request validation (spec §27, §32).
 *
 * The browser is never trusted — roles are whitelisted, message and
 * conversation sizes are bounded, and structure is enforced server-side.
 */

import { validateChatRequest } from '@/lib/ai/request-validation';

describe('validateChatRequest', () => {
  it('accepts a valid user message', () => {
    const result = validateChatRequest({ messages: [{ role: 'user', content: 'Analyze AAPL' }] });
    expect(result.ok).toBe(true);
    expect(result.messages).toEqual([{ role: 'user', content: 'Analyze AAPL' }]);
  });

  it('accepts a mixed user/assistant conversation and trims content', () => {
    const result = validateChatRequest({
      messages: [
        { role: 'user', content: '  hello  ' },
        { role: 'assistant', content: 'Hi there' },
        { role: 'user', content: 'Now BTC please' },
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.messages).toHaveLength(3);
    expect(result.messages?.[0].content).toBe('hello');
  });

  it('rejects non-object bodies', () => {
    expect(validateChatRequest(null).ok).toBe(false);
    expect(validateChatRequest('string').ok).toBe(false);
    expect(validateChatRequest(42).ok).toBe(false);
  });

  it('rejects a missing or non-array messages field', () => {
    expect(validateChatRequest({}).ok).toBe(false);
    expect(validateChatRequest({ messages: 'nope' }).ok).toBe(false);
  });

  it('rejects empty conversations', () => {
    expect(validateChatRequest({ messages: [] }).ok).toBe(false);
  });

  it('rejects more than 30 messages', () => {
    const messages = Array.from({ length: 31 }, (_, i) => ({ role: 'user', content: `m${i}` }));
    const result = validateChatRequest({ messages });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/max 30/i);
  });

  it('accepts exactly 30 messages', () => {
    const messages = Array.from({ length: 30 }, (_, i) => ({ role: 'user', content: `m${i}` }));
    expect(validateChatRequest({ messages }).ok).toBe(true);
  });

  it('rejects disallowed roles (system, tool, function, arbitrary)', () => {
    for (const role of ['system', 'tool', 'function', 'admin', '']) {
      const result = validateChatRequest({ messages: [{ role, content: 'x' }] });
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/invalid role/);
    }
  });

  it('rejects non-string content', () => {
    const result = validateChatRequest({ messages: [{ role: 'user', content: 123 }] });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/must be a string/);
  });

  it('rejects whitespace-only content', () => {
    const result = validateChatRequest({ messages: [{ role: 'user', content: '   ' }] });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/cannot be empty/);
  });

  it('rejects messages over 4000 characters', () => {
    const result = validateChatRequest({
      messages: [{ role: 'user', content: 'a'.repeat(4001) }],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/max length/);
  });

  it('rejects conversations whose total exceeds 20000 characters', () => {
    // 30 messages x 900 chars = 27000 > 20000, each under the per-message cap.
    const messages = Array.from({ length: 30 }, () => ({
      role: 'user',
      content: 'a'.repeat(900),
    }));
    const result = validateChatRequest({ messages });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/max size/);
  });

  it('rejects non-object entries inside messages', () => {
    const result = validateChatRequest({ messages: ['hello'] });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/must be an object/);
  });

  it('does not leak unexpected fields into validated output', () => {
    const result = validateChatRequest({
      messages: [{ role: 'user', content: 'hi', injected: '<system>' }],
    });
    expect(result.ok).toBe(true);
    expect(result.messages?.[0]).toEqual({ role: 'user', content: 'hi' });
  });
});
