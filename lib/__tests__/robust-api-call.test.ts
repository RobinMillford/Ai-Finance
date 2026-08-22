import { robustApiCall } from '../robust-api-call';

function makeReader(chunks: Array<string | Uint8Array>) {
  let i = 0;
  return {
    read: async () => {
      if (i >= chunks.length) return { done: true, value: undefined };
      const c = chunks[i++];
      const val = typeof c === 'string' ? new TextEncoder().encode(c) : c;
      return { done: false, value: val };
    }
  };
}

beforeEach(() => {
  // reset global.fetch
  // @ts-ignore
  global.fetch = undefined;
});

test('streams agent updates and final message', async () => {
  const chunks = [
    'data: {"type":"agent","agent":"a1","status":"ok","message":"step1"}\n',
    'data: {"type":"stream","chunk":"hello "}\n',
    'data: {"type":"final","message":"hello world"}\n',
  ];

  // @ts-ignore
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    body: { getReader: () => makeReader(chunks) }
  });

  const onAgent = jest.fn();
  const onStream = jest.fn();
  const onComplete = jest.fn();

  const result = await robustApiCall({
    endpoint: 'https://api',
    messages: [{ role: 'user', content: 'x' }],
    onAgentUpdate: onAgent,
    onStream: onStream,
    onComplete: onComplete,
    timeout: 5000,
    maxRetries: 0,
  });

  expect(result.response).toBe('hello world');
  expect(result.steps.length).toBe(1);
  expect(onAgent).toHaveBeenCalledWith('a1', 'ok', 'step1');
  expect(onComplete).toHaveBeenCalledWith('hello world');
});

test('throws API error when non-ok response', async () => {
  // @ts-ignore
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 500,
    json: async () => ({ error: 'Bad', details: 'reason' })
  });

  await expect(robustApiCall({ endpoint: 'x', messages: [] , maxRetries: 0})).rejects.toThrow(/Bad: reason/);
});

test('handles abort timeout as AbortError', async () => {
  // Simulate a fetch that respects AbortSignal and rejects with AbortError when aborted
  // @ts-ignore
  global.fetch = jest.fn((url: any, init: any) => {
    return new Promise((_resolve, reject) => {
      const sig: AbortSignal | undefined = init?.signal;
      if (sig) {
        if (sig.aborted) return reject(Object.assign(new Error('AbortError'), { name: 'AbortError' }));
        sig.addEventListener('abort', () => reject(Object.assign(new Error('AbortError'), { name: 'AbortError' })), { once: true });
      }
      // never resolve to simulate hanging request
    });
  });

  const controller = new AbortController();
  setTimeout(() => controller.abort(), 20);

  await expect(robustApiCall({ endpoint: 'x', messages: [], timeout: 60000, maxRetries: 0, signal: controller.signal })).rejects.toThrow(/Request timeout|abort/i);
});
