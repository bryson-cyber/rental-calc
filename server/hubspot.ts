/**
 * HubSpot Integration Module
 * Handles contact creation, updates, and email automation for the rental calculator
 */

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

interface HubSpotContact {
  id: string;
  properties: {
    email: string;
    firstname?: string;
    lastname?: string;
    phone?: string;
    [key: string]: string | undefined;
  };
}

interface CreateContactInput {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  source?: string;
  toolUsed?: string;
  marketAnalyzed?: string;
  estimatedRevenue?: number;
  propertyAddress?: string;
  deepLink?: string;
}

interface HubSpotError {
  status: string;
  message: string;
  correlationId: string;
  category: string;
}

/**
 * Make authenticated request to HubSpot API
 */
async function hubspotRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (!HUBSPOT_API_KEY) {
    throw new Error('HUBSPOT_API_KEY is not configured');
  }

  const response = await fetch(`${HUBSPOT_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as HubSpotError;
    throw new Error(`HubSpot API error: ${response.status} - ${errorData.message || response.statusText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Search for an existing contact by email
 */
export async function findContactByEmail(email: string): Promise<HubSpotContact | null> {
  try {
    const response = await hubspotRequest<{ results: HubSpotContact[] }>(
      '/crm/v3/objects/contacts/search',
      {
        method: 'POST',
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                {
                  propertyName: 'email',
                  operator: 'EQ',
                  value: email,
                },
              ],
            },
          ],
          properties: [
            'email',
            'firstname',
            'lastname',
            'phone',
            'rental_calculator_lead_source',
            'rental_calculator_last_tool_used',
            'rental_calculator_city',
            'rental_calculator_state',
            'rental_calculator_estimated_revenue',
            'rental_calculator_property_address',
            'deep_link_url',
          ],
        }),
      }
    );

    return response.results.length > 0 ? response.results[0] : null;
  } catch (error) {
    console.error('Error searching for contact:', error);
    return null;
  }
}

/**
 * Create a new contact in HubSpot
 */
export async function createContact(input: CreateContactInput): Promise<HubSpotContact> {
  const properties: Record<string, string> = {
    email: input.email,
  };

  if (input.firstName) properties.firstname = input.firstName;
  if (input.lastName) properties.lastname = input.lastName;
  if (input.phone) properties.phone = input.phone;
  if (input.source) properties.rental_calculator_lead_source = input.source;
  if (input.toolUsed) properties.rental_calculator_last_tool_used = input.toolUsed;
  if (input.marketAnalyzed) {
    // Parse city and state from market string like "Austin, TX"
    const parts = input.marketAnalyzed.split(',').map(s => s.trim());
    if (parts[0]) properties.rental_calculator_city = parts[0];
    if (parts[1]) properties.rental_calculator_state = parts[1];
  }
  if (input.estimatedRevenue) properties.rental_calculator_estimated_revenue = String(input.estimatedRevenue);
  if (input.propertyAddress) properties.rental_calculator_property_address = input.propertyAddress;
  if (input.deepLink) properties.deep_link_url = input.deepLink;

  return hubspotRequest<HubSpotContact>('/crm/v3/objects/contacts', {
    method: 'POST',
    body: JSON.stringify({ properties }),
  });
}

/**
 * Update an existing contact in HubSpot
 */
export async function updateContact(
  contactId: string,
  input: Partial<CreateContactInput>
): Promise<HubSpotContact> {
  const properties: Record<string, string> = {};

  if (input.firstName) properties.firstname = input.firstName;
  if (input.lastName) properties.lastname = input.lastName;
  if (input.phone) properties.phone = input.phone;
  if (input.source) properties.rental_calculator_lead_source = input.source;
  if (input.toolUsed) properties.rental_calculator_last_tool_used = input.toolUsed;
  if (input.marketAnalyzed) {
    // Parse city and state from market string like "Austin, TX"
    const parts = input.marketAnalyzed.split(',').map(s => s.trim());
    if (parts[0]) properties.rental_calculator_city = parts[0];
    if (parts[1]) properties.rental_calculator_state = parts[1];
  }
  if (input.estimatedRevenue) properties.rental_calculator_estimated_revenue = String(input.estimatedRevenue);
  if (input.propertyAddress) properties.rental_calculator_property_address = input.propertyAddress;
  if (input.deepLink) properties.deep_link_url = input.deepLink;

  return hubspotRequest<HubSpotContact>(`/crm/v3/objects/contacts/${contactId}`, {
    method: 'PATCH',
    body: JSON.stringify({ properties }),
  });
}

/**
 * Create or update a contact (upsert)
 * If contact exists, update it; otherwise create new
 */
export async function upsertContact(input: CreateContactInput): Promise<{
  contact: HubSpotContact;
  isNew: boolean;
}> {
  // First, try to find existing contact
  const existingContact = await findContactByEmail(input.email);

  if (existingContact) {
    // Update existing contact
    const updatedContact = await updateContact(existingContact.id, input);
    return { contact: updatedContact, isNew: false };
  } else {
    // Create new contact
    const newContact = await createContact(input);
    return { contact: newContact, isNew: true };
  }
}

/**
 * Add a contact to a static list
 */
export async function addContactToList(contactId: string, listId: string): Promise<void> {
  await hubspotRequest(`/contacts/v1/lists/${listId}/add`, {
    method: 'POST',
    body: JSON.stringify({
      vids: [parseInt(contactId, 10)],
    }),
  });
}

/**
 * Get all static lists
 */
export async function getLists(): Promise<Array<{ listId: number; name: string }>> {
  const response = await hubspotRequest<{ lists: Array<{ listId: number; name: string }> }>(
    '/contacts/v1/lists/static'
  );
  return response.lists;
}

/**
 * Create a static list
 */
export async function createList(name: string): Promise<{ listId: number; name: string }> {
  return hubspotRequest<{ listId: number; name: string }>('/contacts/v1/lists', {
    method: 'POST',
    body: JSON.stringify({
      name,
      dynamic: false,
    }),
  });
}

/**
 * Generate a personalized deep link for email campaigns
 */
export function generateDeepLink(params: {
  baseUrl: string;
  tool: string;
  market?: string;
  city?: string;
  state?: string;
  email?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}): string {
  const url = new URL(params.baseUrl);
  
  // Set the tool path
  const toolPaths: Record<string, string> = {
    'calculator': '/',
    'market-advisor': '/market-advisor',
    'opportunity-finder': '/opportunity-finder',
    'market-discovery': '/discover-markets',
    'market-comparison': '/compare-markets',
    'map': '/map',
  };
  
  url.pathname = toolPaths[params.tool] || '/';
  
  // Add market/location parameters
  if (params.market) url.searchParams.set('market', params.market);
  if (params.city) url.searchParams.set('city', params.city);
  if (params.state) url.searchParams.set('state', params.state);
  
  // Add UTM tracking parameters
  if (params.utm_source) url.searchParams.set('utm_source', params.utm_source);
  if (params.utm_medium) url.searchParams.set('utm_medium', params.utm_medium);
  if (params.utm_campaign) url.searchParams.set('utm_campaign', params.utm_campaign);
  
  // Add email for personalization tracking
  if (params.email) url.searchParams.set('ref', Buffer.from(params.email).toString('base64'));
  
  return url.toString();
}

/**
 * Track a lead conversion event
 * Call this when a user completes a significant action
 */
export async function trackLeadEvent(params: {
  email: string;
  eventType: 'calculator_completed' | 'market_analyzed' | 'property_saved' | 'report_generated';
  eventData?: Record<string, string | number>;
}): Promise<void> {
  // Find the contact
  const contact = await findContactByEmail(params.email);
  if (!contact) {
    console.warn(`Contact not found for event tracking: ${params.email}`);
    return;
  }

  // Update contact with event timestamp
  const eventProperty = `rental_calculator_${params.eventType}_at`;
  await updateContact(contact.id, {
    [eventProperty]: new Date().toISOString(),
    ...params.eventData,
  } as any);
}

/**
 * Batch create or update contacts
 */
export async function batchUpsertContacts(
  contacts: CreateContactInput[]
): Promise<{ created: number; updated: number; errors: number }> {
  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const contact of contacts) {
    try {
      const result = await upsertContact(contact);
      if (result.isNew) {
        created++;
      } else {
        updated++;
      }
    } catch (error) {
      console.error(`Error upserting contact ${contact.email}:`, error);
      errors++;
    }
  }

  return { created, updated, errors };
}

/**
 * Patch arbitrary properties on a contact (generic variant of updateContact
 * for callers that own their property names, e.g. webinar lead priority).
 */
export async function updateContactProperties(
  contactId: string,
  properties: Record<string, string>
): Promise<void> {
  await hubspotRequest(`/crm/v3/objects/contacts/${contactId}`, {
    method: 'PATCH',
    body: JSON.stringify({ properties }),
  });
}

/**
 * Make sure a set of custom contact properties exists, creating any that are
 * missing. Safe to call repeatedly; existing properties are left untouched.
 */
export async function ensureCustomContactProperties(
  defs: Array<{ name: string; label: string }>
): Promise<void> {
  const existing = await getContactProperties();
  const have = new Set(existing.map((p) => p.name));
  for (const def of defs) {
    if (have.has(def.name)) continue;
    try {
      await createContactProperty({ name: def.name, label: def.label, type: 'string' });
    } catch (err: any) {
      // 409 = created by a concurrent process — fine
      if (!String(err?.message).includes('409')) {
        console.warn(`[HubSpot] Could not create property ${def.name}:`, err.message);
      }
    }
  }
}

/**
 * Get contact properties (for checking if custom properties exist)
 */
export async function getContactProperties(): Promise<Array<{ name: string; label: string }>> {
  const response = await hubspotRequest<Array<{ name: string; label: string }>>(
    '/crm/v3/properties/contacts'
  );
  return response;
}

/**
 * Create a custom contact property
 */
export async function createContactProperty(params: {
  name: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'datetime';
  groupName?: string;
}): Promise<void> {
  await hubspotRequest('/crm/v3/properties/contacts', {
    method: 'POST',
    body: JSON.stringify({
      name: params.name,
      label: params.label,
      type: params.type,
      fieldType: params.type === 'string' ? 'text' : params.type,
      groupName: params.groupName || 'contactinformation',
    }),
  });
}

export default {
  findContactByEmail,
  createContact,
  updateContact,
  upsertContact,
  addContactToList,
  getLists,
  createList,
  generateDeepLink,
  trackLeadEvent,
  batchUpsertContacts,
  getContactProperties,
  createContactProperty,
};


// ============================================
// NEWSLETTER AUTOMATION FUNCTIONS
// Deal Flow Machine - HubSpot Integration
// ============================================

// axios removed — using native fetch for smaller bundle and fewer vulnerabilities

// Data Perfection field names from HubSpot
const DATA_PERFECTION_CITY = 'data_perfection__city';
const DATA_PERFECTION_STATE = 'data_perfection__state';
const DATA_PERFECTION_POSTAL_CODE = 'data_perfection__postal_code';
const DATA_PERFECTION_PHONE = 'data_perfection__phones';

interface NewsletterContact {
  hubspotId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  state: string;
  postalCode: string;
}

interface CityContactGroup {
  city: string;
  state: string;
  postalCode: string;
  contacts: NewsletterContact[];
}

interface HubSpotSearchResponse {
  total: number;
  results: Array<{
    id: string;
    properties: Record<string, string | undefined>;
    createdAt: string;
    updatedAt: string;
  }>;
  paging?: {
    next?: {
      after: string;
    };
  };
}

/**
 * Get all contacts with city data from HubSpot
 * Uses the CRM Search API to retrieve contacts with Data Perfection fields
 */
export async function getAllContactsWithCity(): Promise<NewsletterContact[]> {
  if (!HUBSPOT_API_KEY) {
    throw new Error('HUBSPOT_API_KEY is not configured');
  }

  const allContacts: NewsletterContact[] = [];
  let after: string | undefined;
  
  do {
    const res = await fetch(
      `${HUBSPOT_BASE_URL}/crm/v3/objects/contacts/search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                {
                  propertyName: DATA_PERFECTION_CITY,
                  operator: 'HAS_PROPERTY'
                }
              ]
            }
          ],
          properties: [
            'email',
            'firstname',
            'lastname',
            'phone',
            DATA_PERFECTION_CITY,
            DATA_PERFECTION_STATE,
            DATA_PERFECTION_POSTAL_CODE,
            DATA_PERFECTION_PHONE
          ],
          limit: 100,
          after
        })
      }
    );
    const response: HubSpotSearchResponse = await res.json();

    const contacts = response.results.map(contact => ({
      hubspotId: contact.id,
      email: contact.properties.email || '',
      firstName: contact.properties.firstname || '',
      lastName: contact.properties.lastname || '',
      phone: contact.properties[DATA_PERFECTION_PHONE] || contact.properties.phone || '',
      city: contact.properties[DATA_PERFECTION_CITY] || '',
      state: contact.properties[DATA_PERFECTION_STATE] || '',
      postalCode: contact.properties[DATA_PERFECTION_POSTAL_CODE] || ''
    }));

    allContacts.push(...contacts.filter(c => c.email && c.city));
    after = response.paging?.next?.after;
  } while (after);

  return allContacts;
}

/**
 * Get contacts for a specific city
 */
export async function getContactsByCity(city: string, state?: string): Promise<NewsletterContact[]> {
  if (!HUBSPOT_API_KEY) {
    throw new Error('HUBSPOT_API_KEY is not configured');
  }

  const filters: Array<{ propertyName: string; operator: string; value: string }> = [
    {
      propertyName: DATA_PERFECTION_CITY,
      operator: 'EQ',
      value: city.toUpperCase()
    }
  ];

  if (state) {
    filters.push({
      propertyName: DATA_PERFECTION_STATE,
      operator: 'EQ',
      value: state.toUpperCase()
    });
  }

  const allContacts: NewsletterContact[] = [];
  let after: string | undefined;

  do {
    const res2 = await fetch(
      `${HUBSPOT_BASE_URL}/crm/v3/objects/contacts/search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filterGroups: [{ filters }],
          properties: [
            'email',
            'firstname',
            'lastname',
            'phone',
            DATA_PERFECTION_CITY,
            DATA_PERFECTION_STATE,
            DATA_PERFECTION_POSTAL_CODE,
            DATA_PERFECTION_PHONE
          ],
          limit: 100,
          after
        })
      }
    );
    const response2: HubSpotSearchResponse = await res2.json();

    const contacts = response2.results.map(contact => ({
      hubspotId: contact.id,
      email: contact.properties.email || '',
      firstName: contact.properties.firstname || '',
      lastName: contact.properties.lastname || '',
      phone: contact.properties[DATA_PERFECTION_PHONE] || contact.properties.phone || '',
      city: contact.properties[DATA_PERFECTION_CITY] || '',
      state: contact.properties[DATA_PERFECTION_STATE] || '',
      postalCode: contact.properties[DATA_PERFECTION_POSTAL_CODE] || ''
    }));

    allContacts.push(...contacts.filter(c => c.email));
    after = response2.paging?.next?.after;
  } while (after);

  return allContacts;
}

/**
 * Look up a single contact's location by email. This is the primary address
 * source for webinar leads: Data Perfection fields are populated from the
 * opt-in / soft-pull flow, with HubSpot's standard city/state/zip as backup.
 * Returns null when HubSpot is unconfigured, the contact is unknown, or no
 * city is on file — callers fall back to local tables.
 */
export async function getContactLocationByEmail(email: string): Promise<{
  hubspotId: string;
  city: string;
  state: string;
  postalCode: string;
} | null> {
  if (!HUBSPOT_API_KEY) return null;
  try {
    const res = await fetch(`${HUBSPOT_BASE_URL}/crm/v3/objects/contacts/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filterGroups: [{
          filters: [{ propertyName: 'email', operator: 'EQ', value: email }]
        }],
        properties: [
          'email',
          'city',
          'state',
          'zip',
          DATA_PERFECTION_CITY,
          DATA_PERFECTION_STATE,
          DATA_PERFECTION_POSTAL_CODE
        ],
        limit: 1
      })
    });
    if (!res.ok) {
      console.warn(`[HubSpot] Contact lookup failed for ${email}: ${res.status}`);
      return null;
    }
    const response: HubSpotSearchResponse = await res.json();
    const contact = response.results?.[0];
    if (!contact) return null;
    const props = contact.properties || {};
    const city = props[DATA_PERFECTION_CITY] || props.city || '';
    const state = props[DATA_PERFECTION_STATE] || props.state || '';
    const postalCode = props[DATA_PERFECTION_POSTAL_CODE] || props.zip || '';
    if (!city || !state) return null;
    return { hubspotId: contact.id, city, state, postalCode };
  } catch (error) {
    console.warn(`[HubSpot] Contact lookup error for ${email}:`, error);
    return null;
  }
}

/**
 * Group contacts by city
 * Returns a map of city -> contacts for batch processing
 */
export async function getContactsGroupedByCity(): Promise<CityContactGroup[]> {
  const allContacts = await getAllContactsWithCity();
  
  const cityMap = new Map<string, CityContactGroup>();
  
  for (const contact of allContacts) {
    const key = `${contact.city.toUpperCase()}-${contact.state.toUpperCase()}`;
    
    if (!cityMap.has(key)) {
      cityMap.set(key, {
        city: contact.city.toUpperCase(),
        state: contact.state.toUpperCase(),
        postalCode: contact.postalCode,
        contacts: []
      });
    }
    
    cityMap.get(key)!.contacts.push(contact);
  }
  
  return Array.from(cityMap.values());
}

/**
 * Get unique cities from all contacts
 * Used to determine which markets to scan for deals
 */
export async function getUniqueCities(): Promise<Array<{ city: string; state: string; postalCode: string; contactCount: number }>> {
  const groups = await getContactsGroupedByCity();
  
  return groups.map(g => ({
    city: g.city,
    state: g.state,
    postalCode: g.postalCode,
    contactCount: g.contacts.length
  }));
}

/**
 * Send a single email via HubSpot Single Send API
 * Requires Marketing Hub Enterprise
 */
export async function sendMarketingEmail(params: {
  emailId: number; // HubSpot email template ID
  recipientEmail: string;
  contactProperties?: Record<string, string>;
  customProperties?: Record<string, string>;
}): Promise<{ success: boolean; sendId?: string; error?: string }> {
  if (!HUBSPOT_API_KEY) {
    throw new Error('HUBSPOT_API_KEY is not configured');
  }

  try {
    const sendId = `deal-flow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    await fetch(
      `${HUBSPOT_BASE_URL}/marketing/v4/email/single-send`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          emailId: params.emailId,
          message: {
            to: params.recipientEmail,
            sendId
          },
          contactProperties: params.contactProperties || {},
          customProperties: params.customProperties || {}
        })
      }
    );

    return {
      success: true,
      sendId
    };
  } catch (error: any) {
    console.error('HubSpot Single Send Error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
}

/**
 * Send batch marketing emails to multiple recipients
 * Handles rate limiting and retries
 */
export async function sendBatchMarketingEmails(params: {
  emailId: number;
  recipients: Array<{
    email: string;
    contactProperties?: Record<string, string>;
    customProperties?: Record<string, string>;
  }>;
}): Promise<{
  successful: number;
  failed: number;
  errors: Array<{ email: string; error: string }>;
}> {
  const results = {
    successful: 0,
    failed: 0,
    errors: [] as Array<{ email: string; error: string }>
  };

  // Process in batches of 10 to respect rate limits
  const batchSize = 10;
  for (let i = 0; i < params.recipients.length; i += batchSize) {
    const batch = params.recipients.slice(i, i + batchSize);
    
    const promises = batch.map(async (recipient) => {
      const result = await sendMarketingEmail({
        emailId: params.emailId,
        recipientEmail: recipient.email,
        contactProperties: recipient.contactProperties,
        customProperties: recipient.customProperties
      });

      if (result.success) {
        results.successful++;
      } else {
        results.failed++;
        results.errors.push({
          email: recipient.email,
          error: result.error || 'Unknown error'
        });
      }
    });

    await Promise.all(promises);
    
    // Small delay between batches to respect rate limits
    if (i + batchSize < params.recipients.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}

export type { NewsletterContact, CityContactGroup };
