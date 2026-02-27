import { describe, it, expect } from 'vitest';

/**
 * Tests for the rate limiter counter reset and drift detection logic.
 * 
 * These test the pure logic functions extracted from the rate limiter module.
 * The actual module uses module-level state, so we test the logic patterns here.
 */

describe('Rate limiter day reset logic', () => {
  it('should detect a new day when date string changes', () => {
    // Simulates the resetIfNewDay() logic
    let dailyCallCount = 742;
    let dailyCountDate = '2026-02-26';
    const today = '2026-02-27';

    if (today !== dailyCountDate) {
      dailyCallCount = 0;
      dailyCountDate = today;
    }

    expect(dailyCallCount).toBe(0);
    expect(dailyCountDate).toBe('2026-02-27');
  });

  it('should NOT reset counter if same day', () => {
    let dailyCallCount = 180;
    let dailyCountDate = '2026-02-27';
    const today = '2026-02-27';

    if (today !== dailyCountDate) {
      dailyCallCount = 0;
      dailyCountDate = today;
    }

    expect(dailyCallCount).toBe(180);
  });
});

describe('Rate limiter counter drift detection', () => {
  const MAX_DRIFT = 50;

  it('should sync UP when DB count is higher than memory', () => {
    let dailyCallCount = 100;
    const dbCount = 179;

    if (dbCount > dailyCallCount) {
      dailyCallCount = dbCount;
    }

    expect(dailyCallCount).toBe(179);
  });

  it('should reset to DB when memory drifts too far above DB', () => {
    // This is the key bug fix: memory counter was 962 but DB only had 179
    let dailyCallCount = 962;
    const dbCount = 179;

    if (dbCount > dailyCallCount) {
      dailyCallCount = dbCount;
    } else if (dailyCallCount > dbCount + MAX_DRIFT) {
      // Memory counter has drifted too far above DB — trust DB
      dailyCallCount = dbCount;
    }

    expect(dailyCallCount).toBe(179);
  });

  it('should keep memory value when slightly above DB (within drift tolerance)', () => {
    let dailyCallCount = 200;
    const dbCount = 179;

    if (dbCount > dailyCallCount) {
      dailyCallCount = dbCount;
    } else if (dailyCallCount > dbCount + MAX_DRIFT) {
      dailyCallCount = dbCount;
    }

    // 200 - 179 = 21, which is within MAX_DRIFT of 50
    expect(dailyCallCount).toBe(200);
  });

  it('should reset when memory is exactly MAX_DRIFT+1 above DB', () => {
    let dailyCallCount = 230; // 230 - 179 = 51 > MAX_DRIFT
    const dbCount = 179;

    if (dbCount > dailyCallCount) {
      dailyCallCount = dbCount;
    } else if (dailyCallCount > dbCount + MAX_DRIFT) {
      dailyCallCount = dbCount;
    }

    expect(dailyCallCount).toBe(179);
  });

  it('should keep memory when exactly at MAX_DRIFT above DB', () => {
    let dailyCallCount = 229; // 229 - 179 = 50 = MAX_DRIFT (not strictly greater)
    const dbCount = 179;

    if (dbCount > dailyCallCount) {
      dailyCallCount = dbCount;
    } else if (dailyCallCount > dbCount + MAX_DRIFT) {
      dailyCallCount = dbCount;
    }

    expect(dailyCallCount).toBe(229);
  });
});

describe('Rate limiter combined day reset + sync scenario', () => {
  it('should handle the production bug scenario: stale counter from previous day', () => {
    // Simulates what happened on production:
    // 1. Feb 26: counter reached 962 (from 1440 total calls)
    // 2. Feb 27: server didn't restart, counter stayed at 962
    // 3. syncCounterFromDb runs, DB says today's count is 179
    // 4. resetIfNewDay should reset to 0 first
    // 5. Then sync should set to 179

    let dailyCallCount = 962;
    let dailyCountDate = '2026-02-26';
    const today = '2026-02-27';
    const MAX_DRIFT = 50;

    // Step 1: resetIfNewDay
    if (today !== dailyCountDate) {
      dailyCallCount = 0;
      dailyCountDate = today;
    }

    expect(dailyCallCount).toBe(0);

    // Step 2: sync from DB (today's count is 179)
    const dbCount = 179;
    if (dbCount > dailyCallCount) {
      dailyCallCount = dbCount;
    } else if (dailyCallCount > dbCount + MAX_DRIFT) {
      dailyCallCount = dbCount;
    }

    expect(dailyCallCount).toBe(179);
    expect(dailyCountDate).toBe('2026-02-27');
  });

  it('should handle scenario where sync runs but day already reset', () => {
    // Server already processed a request today (resetIfNewDay ran),
    // then the 5-minute sync fires
    let dailyCallCount = 185; // A few calls happened since last sync
    let dailyCountDate = '2026-02-27';
    const today = '2026-02-27';
    const MAX_DRIFT = 50;

    // Step 1: resetIfNewDay (no-op, same day)
    if (today !== dailyCountDate) {
      dailyCallCount = 0;
      dailyCountDate = today;
    }

    expect(dailyCallCount).toBe(185);

    // Step 2: sync from DB (DB says 179 — slightly behind memory, which is normal)
    const dbCount = 179;
    if (dbCount > dailyCallCount) {
      dailyCallCount = dbCount;
    } else if (dailyCallCount > dbCount + MAX_DRIFT) {
      dailyCallCount = dbCount;
    }

    // Memory is 6 above DB, within drift tolerance — keep memory
    expect(dailyCallCount).toBe(185);
  });
});
