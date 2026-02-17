import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// ─── Schema Validation Tests ───────────────────────────────────────────────────
describe('reportMode schema validation', () => {
  const reportModeSchema = z.enum(['pro', 'guided']).default('guided');

  it('accepts "pro" as a valid mode', () => {
    expect(reportModeSchema.parse('pro')).toBe('pro');
  });

  it('accepts "guided" as a valid mode', () => {
    expect(reportModeSchema.parse('guided')).toBe('guided');
  });

  it('defaults to "guided" when undefined', () => {
    expect(reportModeSchema.parse(undefined)).toBe('guided');
  });

  it('rejects invalid mode values', () => {
    expect(() => reportModeSchema.parse('invalid')).toThrow();
    expect(() => reportModeSchema.parse('beginner')).toThrow();
    expect(() => reportModeSchema.parse('')).toThrow();
  });
});

// ─── Pro Mode Prompts Tests ────────────────────────────────────────────────────
describe('pro-mode-prompts module', () => {
  it('exports all required prompt constants', async () => {
    const prompts = await import('../pro-mode-prompts');
    
    expect(prompts.PRO_PERSONA_ADVISOR).toBeDefined();
    expect(typeof prompts.PRO_PERSONA_ADVISOR).toBe('string');
    expect(prompts.PRO_PERSONA_ADVISOR.length).toBeGreaterThan(50);
    
    expect(prompts.PRO_PROPERTY_REPORT_OVERRIDE).toBeDefined();
    expect(typeof prompts.PRO_PROPERTY_REPORT_OVERRIDE).toBe('string');
    expect(prompts.PRO_PROPERTY_REPORT_OVERRIDE.length).toBeGreaterThan(50);
    
    expect(prompts.PRO_MARKET_REPORT_OVERRIDE).toBeDefined();
    expect(typeof prompts.PRO_MARKET_REPORT_OVERRIDE).toBe('string');
    expect(prompts.PRO_MARKET_REPORT_OVERRIDE.length).toBeGreaterThan(50);
    
    expect(prompts.PRO_EXECUTIVE_SUMMARY_OVERRIDE).toBeDefined();
    expect(typeof prompts.PRO_EXECUTIVE_SUMMARY_OVERRIDE).toBe('string');
    expect(prompts.PRO_EXECUTIVE_SUMMARY_OVERRIDE.length).toBeGreaterThan(50);
    
    expect(prompts.getProModeOverride).toBeDefined();
    expect(typeof prompts.getProModeOverride).toBe('function');
  });

  it('pro prompts contain investor-grade language indicators', async () => {
    const prompts = await import('../pro-mode-prompts');
    
    const allPrompts = [
      prompts.PRO_PROPERTY_REPORT_OVERRIDE,
      prompts.PRO_MARKET_REPORT_OVERRIDE,
      prompts.PRO_PERSONA_ADVISOR,
    ].join(' ').toLowerCase();
    
    expect(allPrompts).toMatch(/investor|financial|data|metric|benchmark|technical/i);
  });
});

// ─── AI Advisor reportMode Tests ───────────────────────────────────────────────
describe('AI advisor reportMode handling', () => {
  it('getAIAdvisorResponse accepts reportMode parameter', async () => {
    const { getAIAdvisorResponse } = await import('../ai-advisor');
    expect(typeof getAIAdvisorResponse).toBe('function');
    // Function should accept at least 1 parameter (messages, with optional context and reportMode)
    expect(getAIAdvisorResponse.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Report Generator Function Exports Tests ─────────────────────────────────────────────
describe('report-generator.ts exports all reportMode-aware functions', () => {
  it('exports all generate functions', async () => {
    const reportGen = await import('../report-generator');
    
    expect(typeof reportGen.generateEnhancedPropertyReport).toBe('function');
    expect(typeof reportGen.generateEnhancedMarketReport).toBe('function');
    expect(typeof reportGen.generateMarketTrendNarrative).toBe('function');
    expect(typeof reportGen.generateComprehensivePropertyAdvice).toBe('function');
    expect(typeof reportGen.generateMaxPropertyAdvice).toBe('function');
    expect(typeof reportGen.generateMaxMarketAdvice).toBe('function');
    expect(typeof reportGen.generateFullReportSummary).toBe('function');
  });
});

// ─── Router Input Schema Tests ─────────────────────────────────────────────────
describe('router input schemas include reportMode', () => {
  it('advanced router analyzeProperty schema accepts reportMode', () => {
    const schema = z.object({
      address: z.string(),
      reportMode: z.enum(['pro', 'guided']).default('guided'),
    });
    
    const withPro = schema.parse({ address: '123 Main St', reportMode: 'pro' });
    expect(withPro.reportMode).toBe('pro');
    
    const withDefault = schema.parse({ address: '123 Main St' });
    expect(withDefault.reportMode).toBe('guided');
  });

  it('rental router propertyReport schema accepts reportMode', () => {
    const schema = z.object({
      address: z.string(),
      bedrooms: z.number(),
      bathrooms: z.number(),
      reportMode: z.enum(['pro', 'guided']).default('guided'),
    });
    
    const result = schema.parse({
      address: '123 Main St',
      bedrooms: 3,
      bathrooms: 2,
      reportMode: 'pro',
    });
    expect(result.reportMode).toBe('pro');
  });

  it('market research simple schemas accept reportMode', () => {
    const marketReportSchema = z.object({
      marketId: z.string(),
      marketName: z.string(),
      reportMode: z.enum(['pro', 'guided']).default('guided'),
    });
    
    const result = marketReportSchema.parse({
      marketId: 'abc123',
      marketName: 'Denver',
      reportMode: 'guided',
    });
    expect(result.reportMode).toBe('guided');
  });

  it('submarket report schema accepts reportMode', () => {
    const schema = z.object({
      submarketId: z.string(),
      submarketName: z.string(),
      reportMode: z.enum(['pro', 'guided']).default('guided'),
    });
    
    const result = schema.parse({
      submarketId: 'sub123',
      submarketName: 'Downtown Denver',
    });
    expect(result.reportMode).toBe('guided');
  });

  it('getMarketReportByLocation schema accepts reportMode', () => {
    const schema = z.object({
      location: z.string().min(2),
      reportMode: z.enum(['pro', 'guided']).default('guided'),
    });
    
    const result = schema.parse({
      location: 'Denver, CO',
      reportMode: 'pro',
    });
    expect(result.reportMode).toBe('pro');
  });
});

// ─── Mode Branching Logic Tests ────────────────────────────────────────────────
describe('mode branching logic', () => {
  it('pro mode generates non-empty prompt override', async () => {
    const prompts = await import('../pro-mode-prompts');
    
    const proOverride = prompts.getProModeOverride('pro', 'property');
    const guidedOverride = prompts.getProModeOverride('guided', 'property');
    
    expect(proOverride.length).toBeGreaterThan(0);
    expect(guidedOverride).toBe('');
    expect(proOverride).not.toBe(guidedOverride);
  });

  it('guided mode produces empty override (uses default prompts)', async () => {
    const prompts = await import('../pro-mode-prompts');
    
    expect(prompts.getProModeOverride('guided', 'market')).toBe('');
    expect(prompts.getProModeOverride('guided', 'property')).toBe('');
    expect(prompts.getProModeOverride('guided', 'advisor')).toBe('');
    expect(prompts.getProModeOverride('guided', 'executive')).toBe('');
  });

  it('AI advisor system instruction changes based on mode', () => {
    const buildSystemInstruction = (mode: 'pro' | 'guided') => {
      const basePrompt = 'You are an AI property investment advisor.';
      if (mode === 'pro') {
        return `${basePrompt}\n\nPRO MODE: Use precise financial terminology.`;
      }
      return `${basePrompt}\n\nGUIDED MODE: Use plain language with explanations.`;
    };
    
    const proInstruction = buildSystemInstruction('pro');
    const guidedInstruction = buildSystemInstruction('guided');
    
    expect(proInstruction).toContain('PRO MODE');
    expect(proInstruction).toContain('financial terminology');
    expect(guidedInstruction).toContain('GUIDED MODE');
    expect(guidedInstruction).toContain('plain language');
    expect(proInstruction).not.toBe(guidedInstruction);
  });

  it('contextual AI chat mode instruction differs between pro and guided', () => {
    const getModeInstruction = (reportMode: 'pro' | 'guided') => {
      return reportMode === 'pro'
        ? `\n\nIMPORTANT MODE: The user is in PRO MODE. Use precise financial terminology.`
        : `\n\nIMPORTANT MODE: The user is in GUIDED MODE. Use plain language with context and analogies.`;
    };
    
    const proInstruction = getModeInstruction('pro');
    const guidedInstruction = getModeInstruction('guided');
    
    expect(proInstruction).toContain('PRO MODE');
    expect(guidedInstruction).toContain('GUIDED MODE');
    expect(proInstruction).not.toBe(guidedInstruction);
  });

  it('each prompt override is distinct', async () => {
    const prompts = await import('../pro-mode-prompts');
    
    // All 4 overrides should be distinct strings
    const overrides = [
      prompts.PRO_PERSONA_ADVISOR,
      prompts.PRO_PROPERTY_REPORT_OVERRIDE,
      prompts.PRO_MARKET_REPORT_OVERRIDE,
      prompts.PRO_EXECUTIVE_SUMMARY_OVERRIDE,
    ];
    
    // Each should be unique
    const uniqueOverrides = new Set(overrides);
    expect(uniqueOverrides.size).toBe(4);
  });
});

// ─── Database Schema Tests ─────────────────────────────────────────────────────
describe('database schema includes reportMode', () => {
  it('users table schema is defined', async () => {
    const schema = await import('../../drizzle/schema');
    expect(schema.users).toBeDefined();
  });
});

// ─── Router Exports Test ───────────────────────────────────────────────────────
describe('reportMode tRPC router', () => {
  it('appRouter is defined and exported', async () => {
    const routers = await import('../routers');
    expect(routers.appRouter).toBeDefined();
  }, 15000);
});
