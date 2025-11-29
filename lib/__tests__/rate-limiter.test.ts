import { rateLimiter, RATE_LIMITS, getClientIdentifier } from '../rate-limiter';

describe('Rate Limiter', () => {
  beforeEach(() => {
    rateLimiter.clear();
  });

  describe('isRateLimited', () => {
    it('should allow first request', () => {
      const isLimited = rateLimiter.isRateLimited('user1', 10, 60000);
      expect(isLimited).toBe(false);
    });

    it('should allow requests within limit', () => {
      for (let i = 0; i < 5; i++) {
        const isLimited = rateLimiter.isRateLimited('user1', 10, 60000);
        expect(isLimited).toBe(false);
      }
    });

    it('should block requests exceeding limit', () => {
      // Make 10 requests (limit)
      for (let i = 0; i < 10; i++) {
        rateLimiter.isRateLimited('user1', 10, 60000);
      }

      // 11th request should be blocked
      const isLimited = rateLimiter.isRateLimited('user1', 10, 60000);
      expect(isLimited).toBe(true);
    });

    it('should reset after time window expires', () => {
      jest.useFakeTimers();

      // Make 10 requests
      for (let i = 0; i < 10; i++) {
        rateLimiter.isRateLimited('user1', 10, 60000);
      }

      // Should be blocked
      expect(rateLimiter.isRateLimited('user1', 10, 60000)).toBe(true);

      // Fast-forward past the window
      jest.advanceTimersByTime(61000);

      // Should be allowed again
      expect(rateLimiter.isRateLimited('user1', 10, 60000)).toBe(false);

      jest.useRealTimers();
    });

    it('should track different identifiers separately', () => {
      // User1 makes 10 requests
      for (let i = 0; i < 10; i++) {
        rateLimiter.isRateLimited('user1', 10, 60000);
      }

      // User1 should be blocked
      expect(rateLimiter.isRateLimited('user1', 10, 60000)).toBe(true);

      // User2 should not be blocked
      expect(rateLimiter.isRateLimited('user2', 10, 60000)).toBe(false);
    });
  });

  describe('getRemaining', () => {
    it('should return correct remaining count', () => {
      rateLimiter.isRateLimited('user1', 10, 60000);
      rateLimiter.isRateLimited('user1', 10, 60000);
      rateLimiter.isRateLimited('user1', 10, 60000);

      const remaining = rateLimiter.getRemaining('user1', 10);
      expect(remaining).toBe(7);
    });

    it('should return limit for new identifier', () => {
      const remaining = rateLimiter.getRemaining('newuser', 10);
      expect(remaining).toBe(10);
    });
  });

  describe('getResetTime', () => {
    it('should return reset time for active limit', () => {
      jest.useFakeTimers();
      const now = Date.now();

      rateLimiter.isRateLimited('user1', 10, 60000);
      const resetTime = rateLimiter.getResetTime('user1');

      expect(resetTime).toBeGreaterThan(now);
      expect(resetTime).toBeLessThanOrEqual(now + 60000);

      jest.useRealTimers();
    });

    it('should return null for unknown identifier', () => {
      const resetTime = rateLimiter.getResetTime('unknown');
      expect(resetTime).toBeNull();
    });
  });

  describe('RATE_LIMITS configuration', () => {
    it('should have correct API_DEFAULT limits', () => {
      expect(RATE_LIMITS.API_DEFAULT).toEqual({
        limit: 100,
        windowMs: 15 * 60 * 1000,
      });
    });

    it('should have correct MARKET_DATA limits', () => {
      expect(RATE_LIMITS.MARKET_DATA).toEqual({
        limit: 60,
        windowMs: 60 * 1000,
      });
    });

    it('should have correct AI_ENDPOINTS limits', () => {
      expect(RATE_LIMITS.AI_ENDPOINTS).toEqual({
        limit: 20,
        windowMs: 60 * 1000,
      });
    });
  });

  describe('getClientIdentifier', () => {
    it('should use x-forwarded-for header', () => {
      const mockRequest = {
        headers: {
          get: (name: string) => {
            if (name === 'x-forwarded-for') return '192.168.1.1, 10.0.0.1';
            return null;
          },
        },
      } as Request;

      const identifier = getClientIdentifier(mockRequest);
      expect(identifier).toBe('192.168.1.1');
    });

    it('should use x-real-ip header as fallback', () => {
      const mockRequest = {
        headers: {
          get: (name: string) => {
            if (name === 'x-real-ip') return '192.168.1.1';
            return null;
          },
        },
      } as Request;

      const identifier = getClientIdentifier(mockRequest);
      expect(identifier).toBe('192.168.1.1');
    });

    it('should use user-agent + accept-language as last resort', () => {
      const mockRequest = {
        headers: {
          get: (name: string) => {
            if (name === 'user-agent') return 'Mozilla/5.0';
            if (name === 'accept-language') return 'en-US';
            return null;
          },
        },
      } as Request;

      const identifier = getClientIdentifier(mockRequest);
      expect(identifier).toBe('Mozilla/5.0-en-US');
    });
  });
});
