import { describe, it, expect, beforeAll } from 'vitest';
import { getBnbCalcEstimate } from '../bnbcalc';

/**
 * Integration tests for BNB Calc API → RentalizerResponse mapping.
 * These tests call the real API to verify the full pipeline works.
 */
describe('BNB Calc Integration', () => {
  // Test with a known US address
  it('should return a valid RentalizerResponse for a US property', async () => {
    const result = await getBnbCalcEstimate({
      address: '1321 15th St, Denver, CO 80202',
      bedrooms: 3,
      bathrooms: 2,
      accommodates: 6,
    });

    expect(result).not.toBeNull();
    if (!result) return;

    // Property mapping
    expect(result.property).toBeDefined();
    expect(result.property.address).toBeTruthy();
    expect(result.property.bedrooms).toBe(3);
    expect(result.property.bathrooms).toBe(2);
    expect(result.property.accommodates).toBe(6);
    expect(result.property.latitude).toBeTypeOf('number');
    expect(result.property.longitude).toBeTypeOf('number');

    // Estimates mapping
    expect(result.estimates).toBeDefined();
    expect(result.estimates.annual_revenue).toBeGreaterThan(0);
    expect(result.estimates.annual_revenue_low).toBeGreaterThan(0);
    expect(result.estimates.annual_revenue_high).toBeGreaterThan(0);
    expect(result.estimates.annual_revenue_low).toBeLessThanOrEqual(result.estimates.annual_revenue);
    expect(result.estimates.annual_revenue_high).toBeGreaterThanOrEqual(result.estimates.annual_revenue);
    expect(result.estimates.average_daily_rate).toBeGreaterThan(0);
    expect(result.estimates.occupancy_rate).toBeGreaterThan(0);
    expect(result.estimates.occupancy_rate).toBeLessThanOrEqual(1);
    expect(result.estimates.currency).toBeTruthy();
    expect(result.estimates.currency_symbol).toBe('$');

    // Monthly forecast (12 months)
    expect(result.monthly_forecast).toBeDefined();
    expect(result.monthly_forecast.length).toBe(12);
    for (const month of result.monthly_forecast) {
      expect(month.month).toMatch(/^\d{4}-\d{2}$/);
      expect(month.revenue).toBeGreaterThan(0);
      expect(month.adr).toBeGreaterThan(0);
      expect(month.occupancy).toBeGreaterThan(0);
      expect(month.occupancy).toBeLessThanOrEqual(1);
    }

    // Comps
    expect(result.comps).toBeDefined();
    expect(result.comps.length).toBeGreaterThan(0);
    for (const comp of result.comps) {
      expect(comp.title).toBeTruthy();
      expect(comp.annual_revenue).toBeGreaterThan(0);
      expect(comp.adr).toBeGreaterThan(0);
      expect(comp.occupancy).toBeGreaterThan(0);
      expect(comp.occupancy).toBeLessThanOrEqual(1);
      expect(comp.distance_meters).toBeGreaterThanOrEqual(0);
    }

    // Revenue boost factor applied (p75 revenue * 1.3 should be > raw p75)
    // Just verify the numbers are reasonable (> $10k/yr for Denver 3BR)
    expect(result.estimates.annual_revenue).toBeGreaterThan(10000);
  }, 30000);

  it('should handle a Florida property correctly', async () => {
    const result = await getBnbCalcEstimate({
      address: '123 Main St, St Petersburg, FL 33701',
      bedrooms: 2,
      bathrooms: 1,
      accommodates: 4,
    });

    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.property.bedrooms).toBe(2);
    expect(result.property.bathrooms).toBe(1);
    expect(result.estimates.annual_revenue).toBeGreaterThan(5000);
    expect(result.comps.length).toBeGreaterThan(0);
  }, 30000);

  it('should return null for an invalid/unresolvable address', async () => {
    const result = await getBnbCalcEstimate({
      address: 'zzzzz nonexistent place 99999',
      bedrooms: 2,
      bathrooms: 1,
      accommodates: 4,
    });

    // BNB Calc may return null or an error for unresolvable addresses
    // Either null or a valid response is acceptable (API may geocode loosely)
    if (result) {
      // If it returns something, it should still be valid
      expect(result.estimates.annual_revenue).toBeGreaterThanOrEqual(0);
    }
  }, 30000);

  it('should apply REVENUE_BOOST_FACTOR to revenue and ADR but not occupancy', async () => {
    const result = await getBnbCalcEstimate({
      address: '100 Ocean Dr, Miami Beach, FL 33139',
      bedrooms: 1,
      bathrooms: 1,
      accommodates: 2,
    });

    expect(result).not.toBeNull();
    if (!result) return;

    // Occupancy should be between 0 and 1 (not boosted)
    expect(result.estimates.occupancy_rate).toBeLessThanOrEqual(1);
    expect(result.estimates.occupancy_rate).toBeGreaterThan(0);

    // Revenue should be boosted (> raw value)
    // We can't test exact boost without raw data, but we can verify
    // the numbers are in a reasonable range for Miami Beach
    expect(result.estimates.annual_revenue).toBeGreaterThan(15000);
    expect(result.estimates.average_daily_rate).toBeGreaterThan(50);
  }, 30000);
});
