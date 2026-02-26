import { describe, it, expect, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Unit tests for lease-reader.ts
// We test the exported types, JSON parsing logic, and HTML generation
// without making actual API calls (those are mocked).
// ---------------------------------------------------------------------------

// Mock the LLM provider to avoid real API calls
vi.mock('./llm-provider', () => ({
  callLLMWithVision: vi.fn(),
  callLLM: vi.fn(),
}));

// Mock storage
vi.mock('./storage', () => ({
  storagePut: vi.fn().mockResolvedValue({ url: 'https://s3.example.com/test.html', key: 'test.html' }),
}));

import { analyzeLeaseDocument, generateAddendum, generateAddendumPdf, type LeaseAnalysis, type AddendumOutput } from './lease-reader';
import { callLLMWithVision, callLLM } from './llm-provider';

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const sampleAnalysis: LeaseAnalysis = {
  overallGrade: 'B+',
  overallScore: 72,
  arbitrageFriendliness: 'Favorable',
  summaryVerdict: 'This lease is generally favorable for Airbnb arbitrage with some conditions.',
  keyTerms: {
    leaseDuration: '12 months',
    monthlyRent: '$1,800',
    securityDeposit: '$1,800',
    leaseStartDate: 'March 1, 2026',
    leaseEndDate: 'February 28, 2027',
    landlordName: 'John Smith',
    propertyAddress: '456 Oak Ave, Denver, CO 80202',
    tenantName: 'Jane Doe',
  },
  clauses: {
    subletting: {
      status: 'Requires Permission',
      details: 'Subletting is allowed with prior written consent from the landlord.',
      riskLevel: 'Medium',
      exactText: 'Tenant shall not sublet the premises without prior written consent of the Landlord.',
    },
    shortTermRental: {
      status: 'Silent',
      details: 'The lease does not mention short-term rentals specifically.',
      riskLevel: 'Medium',
      exactText: 'Not found in lease',
    },
    assignment: {
      status: 'Prohibited',
      details: 'Assignment of the lease is not permitted.',
      riskLevel: 'Low',
      exactText: 'Tenant may not assign this lease.',
    },
    guestPolicy: {
      status: 'Moderate',
      details: 'Guests are allowed for up to 14 consecutive days.',
      riskLevel: 'Low',
      exactText: 'Guests may stay for up to 14 consecutive days.',
    },
    earlyTermination: {
      penalty: '2 months rent',
      noticePeriod: '60 days',
      details: 'Early termination requires 60 days notice and 2 months penalty.',
    },
    insurance: {
      required: true,
      details: 'Renters insurance required with $100K liability minimum.',
    },
    modifications: {
      allowed: false,
      details: 'No modifications without landlord approval.',
    },
  },
  redFlags: [
    {
      title: 'Subletting requires permission',
      description: 'You need written consent before listing on Airbnb.',
      severity: 'Warning',
      recommendation: 'Get written permission via the addendum before listing.',
    },
  ],
  greenFlags: [
    {
      title: 'No STR prohibition',
      description: 'The lease does not explicitly prohibit short-term rentals.',
    },
  ],
  recommendations: [
    {
      priority: 'High',
      action: 'Get subletting permission in writing',
      reason: 'Required by lease before any Airbnb activity.',
    },
  ],
  addendumPoints: [
    {
      clause: 'Subletting',
      suggestedLanguage: 'Landlord grants Tenant permission to list the premises on short-term rental platforms.',
      reason: 'The lease requires written permission for subletting.',
    },
  ],
};

const sampleAddendum: AddendumOutput = {
  formalText: 'LEASE ADDENDUM - SHORT-TERM RENTAL AUTHORIZATION\n\nDate: February 25, 2026\n\nParties:\nLandlord: John Smith\nTenant: Jane Doe\n\nProperty: 456 Oak Ave, Denver, CO 80202\n\nSECTION 1. SHORT-TERM RENTAL PERMISSION\nLandlord grants Tenant permission to list the premises on Airbnb, VRBO, and similar platforms.\n\n___________________________\nLandlord Signature / Date\n\n___________________________\nTenant Signature / Date',
  emailVersion: {
    subject: 'Lease Addendum Request - Short-Term Rental Authorization',
    body: 'Dear John Smith,\n\nI hope this email finds you well. I am writing to request your consideration of a lease addendum that would allow me to list the property at 456 Oak Ave on short-term rental platforms.\n\nI have attached a formal addendum for your review.\n\nBest regards,\nJane Doe',
  },
  textVersion: 'Hi John, I sent you an email about a lease addendum for 456 Oak Ave regarding short-term rental authorization. Would you have time to discuss this week?',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Lease Reader - analyzeLeaseDocument', () => {
  it('should parse a valid JSON response from Claude', async () => {
    const mockCallLLMWithVision = vi.mocked(callLLMWithVision);
    mockCallLLMWithVision.mockResolvedValueOnce(JSON.stringify(sampleAnalysis));

    // Mock fetch for PDF download
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
    }) as any;

    const result = await analyzeLeaseDocument('https://example.com/lease.pdf', 'pdf');

    expect(result.overallGrade).toBe('B+');
    expect(result.overallScore).toBe(72);
    expect(result.arbitrageFriendliness).toBe('Favorable');
    expect(result.keyTerms.propertyAddress).toBe('456 Oak Ave, Denver, CO 80202');
    expect(result.clauses.subletting.status).toBe('Requires Permission');
    expect(result.redFlags).toHaveLength(1);
    expect(result.greenFlags).toHaveLength(1);
    expect(result.addendumPoints).toHaveLength(1);
  });

  it('should handle JSON wrapped in markdown code blocks', async () => {
    const mockCallLLMWithVision = vi.mocked(callLLMWithVision);
    mockCallLLMWithVision.mockResolvedValueOnce('```json\n' + JSON.stringify(sampleAnalysis) + '\n```');

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
    }) as any;

    const result = await analyzeLeaseDocument('https://example.com/lease.pdf', 'pdf');
    expect(result.overallGrade).toBe('B+');
  });

  it('should throw on invalid JSON response', async () => {
    const mockCallLLMWithVision = vi.mocked(callLLMWithVision);
    mockCallLLMWithVision.mockResolvedValueOnce('This is not JSON at all');

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
    }) as any;

    await expect(analyzeLeaseDocument('https://example.com/lease.pdf', 'pdf'))
      .rejects.toThrow('Failed to parse lease analysis');
  });

  it('should use URL source for image files', async () => {
    const mockCallLLMWithVision = vi.mocked(callLLMWithVision);
    mockCallLLMWithVision.mockResolvedValueOnce(JSON.stringify(sampleAnalysis));

    const result = await analyzeLeaseDocument('https://example.com/lease.jpg', 'image');
    expect(result.overallGrade).toBe('B+');

    // Verify it was called with URL source (not base64)
    expect(mockCallLLMWithVision).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({
          type: 'image',
          source: expect.objectContaining({ type: 'url', url: 'https://example.com/lease.jpg' }),
        }),
      ]),
      expect.any(Object)
    );
  });
});

describe('Lease Reader - generateAddendum', () => {
  it('should parse a valid addendum JSON response', async () => {
    const mockCallLLM = vi.mocked(callLLM);
    mockCallLLM.mockResolvedValueOnce(JSON.stringify(sampleAddendum));

    const result = await generateAddendum(sampleAnalysis, { name: 'Jane Doe' });

    expect(result.formalText).toContain('LEASE ADDENDUM');
    expect(result.emailVersion.subject).toContain('Lease Addendum');
    expect(result.emailVersion.body).toContain('John Smith');
    expect(result.textVersion.length).toBeLessThan(600);
  });

  it('should throw on invalid addendum response', async () => {
    const mockCallLLM = vi.mocked(callLLM);
    mockCallLLM.mockResolvedValueOnce('Not valid JSON');

    await expect(generateAddendum(sampleAnalysis, { name: 'Jane Doe' }))
      .rejects.toThrow('Failed to generate addendum');
  });
});

describe('Lease Reader - generateAddendumPdf', () => {
  it('should generate HTML and store it in S3', async () => {
    const result = await generateAddendumPdf(sampleAddendum, sampleAnalysis);

    expect(result.url).toBe('https://s3.example.com/test.html');
    expect(result.key).toBe('test.html');
  });
});

describe('Lease Analysis Types', () => {
  it('should validate the LeaseAnalysis structure', () => {
    // Verify all required fields exist
    expect(sampleAnalysis.overallGrade).toBeDefined();
    expect(sampleAnalysis.overallScore).toBeGreaterThanOrEqual(0);
    expect(sampleAnalysis.overallScore).toBeLessThanOrEqual(100);
    expect(['Highly Favorable', 'Favorable', 'Neutral', 'Unfavorable', 'Highly Unfavorable'])
      .toContain(sampleAnalysis.arbitrageFriendliness);
    
    // Verify clause structure
    const clauseStatuses = ['Allowed', 'Prohibited', 'Silent', 'Requires Permission'];
    expect(clauseStatuses).toContain(sampleAnalysis.clauses.subletting.status);
    expect(clauseStatuses).toContain(sampleAnalysis.clauses.shortTermRental.status);
    
    // Verify risk levels
    const riskLevels = ['Low', 'Medium', 'High'];
    expect(riskLevels).toContain(sampleAnalysis.clauses.subletting.riskLevel);
    
    // Verify red flag severity
    sampleAnalysis.redFlags.forEach(flag => {
      expect(['Critical', 'Warning', 'Info']).toContain(flag.severity);
    });
    
    // Verify recommendation priorities
    sampleAnalysis.recommendations.forEach(rec => {
      expect(['High', 'Medium', 'Low']).toContain(rec.priority);
    });
  });

  it('should validate the AddendumOutput structure', () => {
    expect(sampleAddendum.formalText).toBeTruthy();
    expect(sampleAddendum.emailVersion.subject).toBeTruthy();
    expect(sampleAddendum.emailVersion.body).toBeTruthy();
    expect(sampleAddendum.textVersion).toBeTruthy();
  });
});
