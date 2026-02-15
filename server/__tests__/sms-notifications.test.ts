import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test the SMS module by mocking fetch and ENV
describe('SMS Notification Service', () => {
  let originalFetch: typeof globalThis.fetch;
  
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('formatPhoneNumber (tested indirectly through sendSMSNotification)', () => {
    it('should format 10-digit US numbers with +1 prefix when sending', async () => {
      let sentPhone = '';
      
      globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        
        if (urlStr.includes('/v2/api/contacts/') && init?.method === 'GET') {
          return new Response(JSON.stringify({ subscriberStatus: 'ACTIVE' }), { status: 200 });
        }
        
        if (urlStr.includes('/v2/api/messages') && init?.method === 'POST') {
          const body = JSON.parse(init?.body as string);
          sentPhone = body.contactPhone;
          return new Response(JSON.stringify({ id: 'msg-fmt' }), { status: 201 });
        }
        
        return new Response('{}', { status: 200 });
      }) as typeof fetch;
      
      const { sendSMSNotification } = await import('../sms-email-notifications');
      await sendSMSNotification('2125551234', 'Test');
      
      expect(sentPhone).toBe('+12125551234');
    });
  });

  describe('ensureSimpleTextingContact behavior', () => {
    it('should create contact before sending SMS when contact does not exist', async () => {
      const fetchCalls: { url: string; method: string; body?: string }[] = [];
      
      // Mock fetch to track all calls
      globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        fetchCalls.push({
          url: urlStr,
          method: init?.method || 'GET',
          body: init?.body as string,
        });
        
        // Contact check - return 404 (not found)
        if (urlStr.includes('/v2/api/contacts/') && init?.method === 'GET') {
          return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 });
        }
        
        // Contact create - return 201
        if (urlStr.includes('/v2/api/contacts') && init?.method === 'POST') {
          return new Response(JSON.stringify({ phone: '12125551234' }), { status: 201 });
        }
        
        // Message send - return 201
        if (urlStr.includes('/v2/api/messages') && init?.method === 'POST') {
          return new Response(JSON.stringify({ id: 'msg-123' }), { status: 201 });
        }
        
        return new Response('{}', { status: 200 });
      }) as typeof fetch;
      
      // Mock ENV
      vi.doMock('../_core/env', () => ({
        ENV: {
          simpletextingApiKey: 'test-api-key',
        },
      }));
      
      // Import fresh module with mocked ENV
      const mod = await import('../sms-email-notifications');
      const result = await mod.sendSMSNotification('2125551234', 'Test message', 'John');
      
      // Should have made 3 calls: check contact, create contact, send message
      expect(fetchCalls.length).toBe(3);
      
      // First call: check if contact exists
      expect(fetchCalls[0].url).toContain('/v2/api/contacts/');
      expect(fetchCalls[0].method).toBe('GET');
      
      // Second call: create the contact
      expect(fetchCalls[1].url).toContain('/v2/api/contacts');
      expect(fetchCalls[1].method).toBe('POST');
      const createBody = JSON.parse(fetchCalls[1].body!);
      expect(createBody.firstName).toBe('John');
      
      // Third call: send the message
      expect(fetchCalls[2].url).toContain('/v2/api/messages');
      expect(fetchCalls[2].method).toBe('POST');
    });

    it('should skip contact creation when contact already exists and is ACTIVE', async () => {
      const fetchCalls: { url: string; method: string }[] = [];
      
      globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        fetchCalls.push({
          url: urlStr,
          method: init?.method || 'GET',
        });
        
        // Contact check - return active contact
        if (urlStr.includes('/v2/api/contacts/') && init?.method === 'GET') {
          return new Response(JSON.stringify({ 
            phone: '12125551234',
            subscriberStatus: 'ACTIVE' 
          }), { status: 200 });
        }
        
        // Message send - return 201
        if (urlStr.includes('/v2/api/messages') && init?.method === 'POST') {
          return new Response(JSON.stringify({ id: 'msg-456' }), { status: 201 });
        }
        
        return new Response('{}', { status: 200 });
      }) as typeof fetch;
      
      vi.doMock('../_core/env', () => ({
        ENV: {
          simpletextingApiKey: 'test-api-key',
        },
      }));
      
      const mod = await import('../sms-email-notifications');
      const result = await mod.sendSMSNotification('2125551234', 'Test message');
      
      // Should have made only 2 calls: check contact (active), send message
      expect(fetchCalls.length).toBe(2);
      expect(fetchCalls[0].method).toBe('GET');
      expect(fetchCalls[1].url).toContain('/v2/api/messages');
    });

    it('should not send SMS when contact has unsubscribed', async () => {
      const fetchCalls: { url: string; method: string }[] = [];
      
      globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        fetchCalls.push({
          url: urlStr,
          method: init?.method || 'GET',
        });
        
        // Contact check - return unsubscribed contact
        if (urlStr.includes('/v2/api/contacts/') && init?.method === 'GET') {
          return new Response(JSON.stringify({ 
            phone: '12125551234',
            subscriberStatus: 'UNSUBSCRIBED' 
          }), { status: 200 });
        }
        
        return new Response('{}', { status: 200 });
      }) as typeof fetch;
      
      vi.doMock('../_core/env', () => ({
        ENV: {
          simpletextingApiKey: 'test-api-key',
        },
      }));
      
      const mod = await import('../sms-email-notifications');
      const result = await mod.sendSMSNotification('2125551234', 'Test message');
      
      // Should fail with opt-out error
      expect(result.success).toBe(false);
      expect(result.error).toContain('opted out');
      
      // Should NOT have made a message send call
      const messageCalls = fetchCalls.filter(c => c.url.includes('/v2/api/messages'));
      expect(messageCalls.length).toBe(0);
    });

    it('should handle INVALID_CONTACT error gracefully after contact creation attempt', async () => {
      globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        
        // Contact check - not found
        if (urlStr.includes('/v2/api/contacts/') && init?.method === 'GET') {
          return new Response('{}', { status: 404 });
        }
        
        // Contact create - success
        if (urlStr.includes('/v2/api/contacts') && init?.method === 'POST') {
          return new Response(JSON.stringify({ phone: '12125551234' }), { status: 201 });
        }
        
        // Message send - INVALID_CONTACT error
        if (urlStr.includes('/v2/api/messages') && init?.method === 'POST') {
          return new Response(JSON.stringify({ 
            errorCode: 'INVALID_CONTACT',
            message: 'Contact marked as invalid'
          }), { status: 409 });
        }
        
        return new Response('{}', { status: 200 });
      }) as typeof fetch;
      
      const { sendSMSNotification } = await import('../sms-email-notifications');
      const result = await sendSMSNotification('2125551234', 'Test message');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('invalid or has been blocked');
    });

    it('should use AUTO mode instead of SINGLE_SMS_STRICTLY for better delivery', async () => {
      let messageBody: any = null;
      
      globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        
        // Contact check - return active
        if (urlStr.includes('/v2/api/contacts/') && init?.method === 'GET') {
          return new Response(JSON.stringify({ subscriberStatus: 'ACTIVE' }), { status: 200 });
        }
        
        // Message send - capture the body
        if (urlStr.includes('/v2/api/messages') && init?.method === 'POST') {
          messageBody = JSON.parse(init?.body as string);
          return new Response(JSON.stringify({ id: 'msg-789' }), { status: 201 });
        }
        
        return new Response('{}', { status: 200 });
      }) as typeof fetch;
      
      vi.doMock('../_core/env', () => ({
        ENV: {
          simpletextingApiKey: 'test-api-key',
        },
      }));
      
      const mod = await import('../sms-email-notifications');
      await mod.sendSMSNotification('2125551234', 'Test message');
      
      // Should use AUTO mode for better delivery
      expect(messageBody).not.toBeNull();
      expect(messageBody.mode).toBe('AUTO');
    });
  });
});
