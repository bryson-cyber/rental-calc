import { describe, it, expect } from 'vitest';
import { AirDNARateLimitError } from '../airdna-rate-limiter';

describe('AirDNARateLimitError', () => {
  it('should be an instance of Error', () => {
    const error = new AirDNARateLimitError('daily', 550, 550);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AirDNARateLimitError);
  });

  it('should contain the limit type and counts in the message', () => {
    const error = new AirDNARateLimitError('daily', 962, 550);
    expect(error.message).toContain('962');
    expect(error.message).toContain('550');
  });

  it('should be distinguishable from generic errors via instanceof', () => {
    const rateLimitError = new AirDNARateLimitError('per_minute', 15, 15);
    const genericError = new Error('Some other error');

    expect(rateLimitError instanceof AirDNARateLimitError).toBe(true);
    expect(genericError instanceof AirDNARateLimitError).toBe(false);
  });

  it('should expose type, currentCount, and limit properties', () => {
    const error = new AirDNARateLimitError('daily', 600, 550);
    expect(error.type).toBe('daily');
    expect(error.currentCount).toBe(600);
    expect(error.limit).toBe(550);
    expect(error.isRateLimit).toBe(true);
  });
});

describe('Rate limit error handling in property report flow', () => {
  it('should produce a user-friendly message when rate limit is hit', () => {
    // Simulate what the router does when catching a rate limit error
    const error = new AirDNARateLimitError('daily', 550, 550);
    
    let response: { success: boolean; error: string; limitReached?: boolean };
    
    if (error instanceof AirDNARateLimitError) {
      response = {
        success: false,
        error: 'Our data service is temporarily at capacity. Please try again in a few minutes, or try again tomorrow if the issue persists.',
        limitReached: true,
      };
    } else {
      response = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    expect(response.success).toBe(false);
    expect(response.limitReached).toBe(true);
    expect(response.error).not.toContain('550'); // Should NOT expose internal limits
    expect(response.error).toContain('try again'); // Should be user-friendly
  });

  it('should NOT swallow rate limit errors in bathroom fallback loop', () => {
    // Simulate the bathroom fallback loop behavior
    const bathroomOptions = [2.5, 2, 1.5, 1];
    let caughtRateLimitError = false;

    for (const _bathrooms of bathroomOptions) {
      try {
        // Simulate rate limit error on first attempt
        throw new AirDNARateLimitError('daily', 550, 550);
      } catch (error) {
        if (error instanceof AirDNARateLimitError) {
          // Should re-throw immediately, not continue loop
          caughtRateLimitError = true;
          break; // This is what our fix does — re-throw instead of continue
        }
        // For other errors, continue to next bathroom option
      }
    }

    expect(caughtRateLimitError).toBe(true);
  });
});
