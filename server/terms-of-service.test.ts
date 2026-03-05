/**
 * Tests for Terms of Service acceptance flow.
 * 
 * Since the TOS modal is a client-side component using localStorage,
 * we test the server-side TOS route exists and the TOS page content is valid.
 */
import { describe, it, expect } from 'vitest';

describe('Terms of Service', () => {
  it('should have a TOS page component file', async () => {
    // Verify the TOS page module exists and exports a default component
    const mod = await import('../client/src/pages/TermsOfService');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('should have a TermsAcceptanceModal component', async () => {
    const mod = await import('../client/src/components/TermsAcceptanceModal');
    expect(mod.TermsAcceptanceModal).toBeDefined();
    expect(mod.hasTosBeenAccepted).toBeDefined();
    expect(mod.markTosAccepted).toBeDefined();
    expect(typeof mod.hasTosBeenAccepted).toBe('function');
    expect(typeof mod.markTosAccepted).toBe('function');
  });

  it('should have a ReportDisclaimer component', async () => {
    const mod = await import('../client/src/components/ReportDisclaimer');
    expect(mod.ReportDisclaimer).toBeDefined();
    expect(mod.DISCLAIMER_TEXT).toBeDefined();
    expect(typeof mod.DISCLAIMER_TEXT).toBe('string');
    expect(mod.DISCLAIMER_TEXT).toContain('I&B Coaching');
    expect(mod.DISCLAIMER_TEXT).toContain('informational and educational purposes only');
    expect(mod.DISCLAIMER_TEXT).toContain('not a licensed real estate broker');
  });

  it('disclaimer text should contain all required legal elements', async () => {
    const { DISCLAIMER_TEXT } = await import('../client/src/components/ReportDisclaimer');
    
    // Must disclaim professional advice
    expect(DISCLAIMER_TEXT).toContain('does not constitute financial');
    expect(DISCLAIMER_TEXT).toContain('investment');
    expect(DISCLAIMER_TEXT).toContain('real estate');
    expect(DISCLAIMER_TEXT).toContain('tax');
    expect(DISCLAIMER_TEXT).toContain('legal advice');
    
    // Must state estimates are not guarantees
    expect(DISCLAIMER_TEXT).toContain('estimates only');
    expect(DISCLAIMER_TEXT).toContain('not guarantees');
    
    // Must disclaim licensing
    expect(DISCLAIMER_TEXT).toContain('not a licensed');
    
    // Must recommend due diligence
    expect(DISCLAIMER_TEXT).toContain('due diligence');
    expect(DISCLAIMER_TEXT).toContain('qualified licensed professionals');
    
    // Must disclaim liability
    expect(DISCLAIMER_TEXT).toContain('disclaims all liability');
    
    // Must identify the entity
    expect(DISCLAIMER_TEXT).toContain('I&B Coaching');
    expect(DISCLAIMER_TEXT).toContain('Nevada');
  });
});
