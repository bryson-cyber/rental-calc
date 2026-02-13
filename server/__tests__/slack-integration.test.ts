import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseSlackInput, formatSlackMessage, postToSlack } from '../slack-integration';
import type { RentalizerResponse } from '../airdna';

// ============================================
// MOCK SETUP
// ============================================

// Mock invokeLLM
vi.mock('../_core/llm', () => ({
  invokeLLM: vi.fn()
}));

// Mock ENV
vi.mock('../_core/env', () => ({
  ENV: {
    slackWebhookUrl: 'https://hooks.slack.com/services/T00/B00/test',
    isProduction: false,
    airdnaApiKey: 'test-key',
    geminiApiKey: 'test-key'
  }
}));

// Mock airdna
vi.mock('../airdna', () => ({
  getRentalizerEstimate: vi.fn()
}));

import { invokeLLM } from '../_core/llm';

const mockInvokeLLM = vi.mocked(invokeLLM);

// ============================================
// SAMPLE DATA
// ============================================

const sampleRentalizerResponse: RentalizerResponse = {
  property: {
    address: '123 Main St, Atlanta, GA 30301',
    bedrooms: 3,
    bathrooms: 2,
    accommodates: 6
  },
  estimates: {
    annual_revenue: 85000,
    annual_revenue_low: 72000,
    annual_revenue_high: 98000,
    average_daily_rate: 285,
    occupancy_rate: 0.73,
    currency: 'USD',
    currency_symbol: '$'
  },
  monthly_forecast: [
    { month: '2025-01', revenue: 5200, adr: 250, occupancy: 0.67 },
    { month: '2025-02', revenue: 5800, adr: 260, occupancy: 0.72 },
    { month: '2025-03', revenue: 6500, adr: 270, occupancy: 0.78 },
    { month: '2025-04', revenue: 7200, adr: 280, occupancy: 0.83 },
    { month: '2025-05', revenue: 8500, adr: 300, occupancy: 0.91 },
    { month: '2025-06', revenue: 9200, adr: 320, occupancy: 0.93 },
    { month: '2025-07', revenue: 9800, adr: 340, occupancy: 0.93 },
    { month: '2025-08', revenue: 8900, adr: 310, occupancy: 0.93 },
    { month: '2025-09', revenue: 7800, adr: 290, occupancy: 0.87 },
    { month: '2025-10', revenue: 6800, adr: 275, occupancy: 0.80 },
    { month: '2025-11', revenue: 5100, adr: 240, occupancy: 0.69 },
    { month: '2025-12', revenue: 4200, adr: 220, occupancy: 0.62 }
  ],
  comps: []
};

// ============================================
// parseSlackInput TESTS
// ============================================

describe('parseSlackInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses a full address with BR/BA', async () => {
    mockInvokeLLM.mockResolvedValueOnce({
      id: 'test',
      created: Date.now(),
      model: 'test',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: JSON.stringify({
            address: '123 Main St, Atlanta, GA 30301',
            bedrooms: 3,
            bathrooms: 2
          })
        },
        finish_reason: 'stop'
      }]
    });

    const result = await parseSlackInput('Analyze 123 Main St, Atlanta, GA 30301, 3BR 2BA');
    expect(result).toEqual({
      address: '123 Main St, Atlanta, GA 30301',
      bedrooms: 3,
      bathrooms: 2
    });
  });

  it('parses an address without BR/BA (defaults to 2BR 1BA)', async () => {
    mockInvokeLLM.mockResolvedValueOnce({
      id: 'test',
      created: Date.now(),
      model: 'test',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: JSON.stringify({
            address: '1622 Halliard Dr, Lawrenceville, GA 30043',
            bedrooms: 2,
            bathrooms: 1
          })
        },
        finish_reason: 'stop'
      }]
    });

    const result = await parseSlackInput('1622 Halliard Dr Lawrenceville GA 30043');
    expect(result).toEqual({
      address: '1622 Halliard Dr, Lawrenceville, GA 30043',
      bedrooms: 2,
      bathrooms: 1
    });
  });

  it('returns null when LLM returns empty content', async () => {
    mockInvokeLLM.mockResolvedValueOnce({
      id: 'test',
      created: Date.now(),
      model: 'test',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: ''
        },
        finish_reason: 'stop'
      }]
    });

    const result = await parseSlackInput('gibberish text');
    expect(result).toBeNull();
  });

  it('returns null when address is too short', async () => {
    mockInvokeLLM.mockResolvedValueOnce({
      id: 'test',
      created: Date.now(),
      model: 'test',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: JSON.stringify({
            address: 'hi',
            bedrooms: 2,
            bathrooms: 1
          })
        },
        finish_reason: 'stop'
      }]
    });

    const result = await parseSlackInput('hi');
    expect(result).toBeNull();
  });

  it('clamps bedrooms to valid range (1-10)', async () => {
    mockInvokeLLM.mockResolvedValueOnce({
      id: 'test',
      created: Date.now(),
      model: 'test',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: JSON.stringify({
            address: '123 Main St, Atlanta, GA',
            bedrooms: 25,
            bathrooms: 0
          })
        },
        finish_reason: 'stop'
      }]
    });

    const result = await parseSlackInput('123 Main St Atlanta GA 25BR 0BA');
    expect(result).toEqual({
      address: '123 Main St, Atlanta, GA',
      bedrooms: 10,
      bathrooms: 1
    });
  });

  it('handles LLM error gracefully', async () => {
    mockInvokeLLM.mockRejectedValueOnce(new Error('API timeout'));

    const result = await parseSlackInput('123 Main St');
    expect(result).toBeNull();
  });

  it('handles content as array of parts', async () => {
    mockInvokeLLM.mockResolvedValueOnce({
      id: 'test',
      created: Date.now(),
      model: 'test',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: [
            { type: 'text' as const, text: JSON.stringify({
              address: '456 Oak Ave, Denver, CO',
              bedrooms: 4,
              bathrooms: 3
            })}
          ]
        },
        finish_reason: 'stop'
      }]
    });

    const result = await parseSlackInput('456 Oak Ave Denver CO 4 bed 3 bath');
    expect(result).toEqual({
      address: '456 Oak Ave, Denver, CO',
      bedrooms: 4,
      bathrooms: 3
    });
  });
});

// ============================================
// formatSlackMessage TESTS
// ============================================

describe('formatSlackMessage', () => {
  it('produces a valid Slack Block Kit message', () => {
    const message = formatSlackMessage(sampleRentalizerResponse, 'test input') as any;
    
    // Should have blocks array
    expect(message.blocks).toBeDefined();
    expect(Array.isArray(message.blocks)).toBe(true);
    
    // Should have fallback text
    expect(message.text).toBeDefined();
    expect(typeof message.text).toBe('string');
  });

  it('includes the property address in the header', () => {
    const message = formatSlackMessage(sampleRentalizerResponse, 'test') as any;
    const header = message.blocks.find((b: any) => b.type === 'header');
    expect(header).toBeDefined();
    expect(header.text.text).toContain('123 Main St, Atlanta, GA 30301');
  });

  it('includes annual revenue in the fields', () => {
    const message = formatSlackMessage(sampleRentalizerResponse, 'test') as any;
    const section = message.blocks.find((b: any) => b.type === 'section' && b.fields);
    expect(section).toBeDefined();
    
    const revenueField = section.fields.find((f: any) => f.text.includes('Annual Revenue'));
    expect(revenueField).toBeDefined();
    expect(revenueField.text).toContain('$85,000');
  });

  it('includes revenue range', () => {
    const message = formatSlackMessage(sampleRentalizerResponse, 'test') as any;
    const section = message.blocks.find((b: any) => b.type === 'section' && b.fields);
    const rangeField = section.fields.find((f: any) => f.text.includes('Revenue Range'));
    expect(rangeField).toBeDefined();
    expect(rangeField.text).toContain('$72,000');
    expect(rangeField.text).toContain('$98,000');
  });

  it('includes ADR and occupancy', () => {
    const message = formatSlackMessage(sampleRentalizerResponse, 'test') as any;
    const section = message.blocks.find((b: any) => b.type === 'section' && b.fields);
    
    const adrField = section.fields.find((f: any) => f.text.includes('Avg Daily Rate'));
    expect(adrField.text).toContain('$285');
    
    const occField = section.fields.find((f: any) => f.text.includes('Occupancy Rate'));
    expect(occField.text).toContain('73%');
  });

  it('includes seasonality highlights with best and worst months', () => {
    const message = formatSlackMessage(sampleRentalizerResponse, 'test') as any;
    const seasonSection = message.blocks.find((b: any) => 
      b.type === 'section' && b.text?.text?.includes('Seasonality')
    );
    expect(seasonSection).toBeDefined();
    // Best month should be July ($9,800)
    expect(seasonSection.text.text).toContain('$9,800');
    // Worst month should be December ($4,200)
    expect(seasonSection.text.text).toContain('$4,200');
  });

  it('includes Zillow and Redfin links', () => {
    const message = formatSlackMessage(sampleRentalizerResponse, 'test') as any;
    const searchSection = message.blocks.find((b: any) =>
      b.type === 'section' && b.text?.text?.includes('Search This Property')
    );
    expect(searchSection).toBeDefined();
    expect(searchSection.text.text).toContain('zillow.com');
    expect(searchSection.text.text).toContain('redfin.com');
  });

  it('includes Validate This Deal link when reportUrl provided', () => {
    const message = formatSlackMessage(
      sampleRentalizerResponse, 
      'test',
      'https://example.com/?tab=validate&address=123'
    ) as any;
    
    const linkSection = message.blocks.find((b: any) => 
      b.type === 'section' && b.text?.text?.includes('Validate This Deal')
    );
    expect(linkSection).toBeDefined();
    expect(linkSection.text.text).toContain('https://example.com/?tab=validate&address=123');
  });

  it('omits Validate link when reportUrl not provided', () => {
    const message = formatSlackMessage(sampleRentalizerResponse, 'test') as any;
    const linkSection = message.blocks.find((b: any) => 
      b.type === 'section' && b.text?.text?.includes('Validate This Deal')
    );
    expect(linkSection).toBeUndefined();
  });

  it('includes footer context', () => {
    const message = formatSlackMessage(sampleRentalizerResponse, 'test') as any;
    const context = message.blocks.find((b: any) => b.type === 'context');
    expect(context).toBeDefined();
    expect(context.elements[0].text).toContain('Coach Inayah');
  });

  it('includes property details (BR/BA)', () => {
    const message = formatSlackMessage(sampleRentalizerResponse, 'test') as any;
    const section = message.blocks.find((b: any) => b.type === 'section' && b.fields);
    const propertyField = section.fields.find((f: any) => f.text.includes('Property'));
    expect(propertyField.text).toContain('3 BR');
    expect(propertyField.text).toContain('2 BA');
  });

  it('fallback text contains address and revenue', () => {
    const message = formatSlackMessage(sampleRentalizerResponse, 'test') as any;
    expect(message.text).toContain('123 Main St, Atlanta, GA 30301');
    expect(message.text).toContain('$85,000');
  });
});

// ============================================
// postToSlack TESTS
// ============================================

describe('postToSlack', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('posts message to the configured webhook URL', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('ok')
    });
    global.fetch = mockFetch as any;

    const message = { text: 'test message' };
    const result = await postToSlack(message);

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://hooks.slack.com/services/T00/B00/test',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      })
    );
  });

  it('uses response_url when provided instead of configured webhook', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('ok')
    });
    global.fetch = mockFetch as any;

    const responseUrl = 'https://hooks.slack.com/workflows/custom-response-url';
    await postToSlack({ text: 'test' }, responseUrl);

    expect(mockFetch).toHaveBeenCalledWith(
      responseUrl,
      expect.any(Object)
    );
  });

  it('returns false on HTTP error', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: () => Promise.resolve('invalid_token')
    });
    global.fetch = mockFetch as any;

    const result = await postToSlack({ text: 'test' });
    expect(result).toBe(false);
  });

  it('returns false on network error', async () => {
    const mockFetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));
    global.fetch = mockFetch as any;

    const result = await postToSlack({ text: 'test' });
    expect(result).toBe(false);
  });
});

// ============================================
// INTEGRATION: handleSlackAnalyze TESTS
// ============================================

describe('handleSlackAnalyze', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock fetch for postToSlack
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('ok')
    }) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends error message when input cannot be parsed', async () => {
    // Make LLM return empty
    mockInvokeLLM.mockResolvedValueOnce({
      id: 'test',
      created: Date.now(),
      model: 'test',
      choices: [{
        index: 0,
        message: { role: 'assistant', content: '' },
        finish_reason: 'stop'
      }]
    });

    const { handleSlackAnalyze } = await import('../slack-integration');
    await handleSlackAnalyze({ 
      text: 'random gibberish',
      response_url: 'https://hooks.slack.com/test'
    });

    // Should have posted an error message
    expect(global.fetch).toHaveBeenCalledWith(
      'https://hooks.slack.com/test',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Analysis Could Not Be Completed')
      })
    );
  });

  it('sends error message when rentalizer returns null', async () => {
    // Make LLM parse successfully
    mockInvokeLLM.mockResolvedValueOnce({
      id: 'test',
      created: Date.now(),
      model: 'test',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: JSON.stringify({
            address: '123 Nowhere St, Faketown, XX 00000',
            bedrooms: 2,
            bathrooms: 1
          })
        },
        finish_reason: 'stop'
      }]
    });

    // Make rentalizer return null
    const { getRentalizerEstimate } = await import('../airdna');
    vi.mocked(getRentalizerEstimate).mockResolvedValueOnce(null);

    const { handleSlackAnalyze } = await import('../slack-integration');
    await handleSlackAnalyze({
      text: '123 Nowhere St Faketown XX 00000',
      response_url: 'https://hooks.slack.com/test'
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://hooks.slack.com/test',
      expect.objectContaining({
        body: expect.stringContaining("couldn't find revenue data")
      })
    );
  });

  it('sends formatted results when analysis succeeds', async () => {
    // Make LLM parse successfully
    mockInvokeLLM.mockResolvedValueOnce({
      id: 'test',
      created: Date.now(),
      model: 'test',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: JSON.stringify({
            address: '123 Main St, Atlanta, GA 30301',
            bedrooms: 3,
            bathrooms: 2
          })
        },
        finish_reason: 'stop'
      }]
    });

    // Make rentalizer return data
    const { getRentalizerEstimate } = await import('../airdna');
    vi.mocked(getRentalizerEstimate).mockResolvedValueOnce(sampleRentalizerResponse);

    const { handleSlackAnalyze } = await import('../slack-integration');
    await handleSlackAnalyze({
      text: 'Analyze 123 Main St Atlanta GA 30301 3BR 2BA',
      response_url: 'https://hooks.slack.com/test'
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://hooks.slack.com/test',
      expect.objectContaining({
        body: expect.stringContaining('$85,000')
      })
    );
  });
});
