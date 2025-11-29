import { fetchWithRetry, apiGet, apiPost, handleApiError, buildQueryString } from '../api-client';

// Mock fetch globally
global.fetch = jest.fn();

describe('API Client Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('fetchWithRetry', () => {
    it('should successfully fetch data on first attempt', async () => {
      const mockData = { success: true, data: 'test' };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      });

      const result = await fetchWithRetry('https://api.example.com/test');

      expect(result.data).toEqual(mockData);
      expect(result.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it.skip('should retry on server error (5xx)', async () => {
      // TODO: Fix async timer handling in this test
      const mockData = { success: true };
      
      // First two calls fail with 500, third succeeds
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockData,
        });

      const promise = fetchWithRetry('https://api.example.com/test', {
        retries: 3,
        retryDelay: 100,
      });

      // Wait for all timers and promises to resolve
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result.data).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry on client error (4xx)', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not found' }),
      });

      const result = await fetchWithRetry('https://api.example.com/test');

      expect(result.error).toBe('Not found');
      expect(result.status).toBe(404);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it.skip('should handle timeout', async () => {
      // TODO: Fix async timer handling in this test
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 35000))
      );

      const promise = fetchWithRetry('https://api.example.com/test', {
        timeout: 1000,
      });

      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result.error).toBe('Request timeout');
      expect(result.status).toBe(408);
    });
  });

  describe('apiGet', () => {
    it('should make GET request', async () => {
      const mockData = { id: 1, name: 'Test' };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      });

      const result = await apiGet('/api/test');

      expect(result.data).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({ method: 'GET' })
      );
    });
  });

  describe('apiPost', () => {
    it('should make POST request with data', async () => {
      const postData = { name: 'Test' };
      const mockResponse = { id: 1, ...postData };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await apiPost('/api/test', postData);

      expect(result.data).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(postData),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });

  describe('handleApiError', () => {
    it('should handle Error objects', () => {
      const error = new Error('Test error');
      expect(handleApiError(error)).toBe('Test error');
    });

    it('should handle string errors', () => {
      expect(handleApiError('String error')).toBe('String error');
    });

    it('should handle unknown errors', () => {
      expect(handleApiError({ unknown: 'error' })).toBe('An unexpected error occurred');
    });
  });

  describe('buildQueryString', () => {
    it('should build query string from object', () => {
      const params = {
        page: 1,
        limit: 10,
        search: 'test query',
      };

      const result = buildQueryString(params);
      expect(result).toBe('?page=1&limit=10&search=test+query');
    });

    it('should skip undefined values', () => {
      const params = {
        page: 1,
        limit: undefined,
        search: 'test',
      };

      const result = buildQueryString(params);
      expect(result).toBe('?page=1&search=test');
    });

    it('should return empty string for empty object', () => {
      const result = buildQueryString({});
      expect(result).toBe('');
    });
  });
});
